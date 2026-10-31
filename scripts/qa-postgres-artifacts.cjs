#!/usr/bin/env node
const { createHash, randomBytes } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const base = process.env.QA_API_URL || "http://127.0.0.1:4251/v1";
const fixtureRoot =
  process.env.ARTIFACT_FIXTURE_DIR ||
  "/Users/moonklabs/workspace-vanilla/phase2-evidence/ai-artifact-platform-20261031/fixtures";
const evidence =
  process.env.ARTIFACT_EVIDENCE_DIR ||
  "/Users/moonklabs/workspace-vanilla/phase2-evidence/postgres-artifact-20261031";
fs.mkdirSync(evidence, { recursive: true, mode: 0o700 });

const suffix = randomBytes(5).toString("hex");
const password = "Qa!Pass2026x";
const checks = [];
const created = [];

function record(name, detail) {
  checks.push({ name, status: "PASS", ...detail });
}

async function json(response) {
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!response.ok)
    throw new Error(
      `${response.status} ${response.url}: ${JSON.stringify(body)}`
    );
  return body;
}

async function signup(userId, email) {
  const response = await fetch(`${base}/login/signup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, email, password }),
  });
  return json(response);
}

async function signin(userId) {
  const response = await fetch(`${base}/login/signin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, password }),
  });
  const body = await json(response);
  if (!body.accessToken)
    throw new Error("signin did not return an access token");
  return body.accessToken;
}

function headers(token) {
  return { authorization: `Bearer ${token}` };
}

async function upload(token, file, title) {
  const form = new FormData();
  form.append("title", title);
  form.append("file", file);
  const response = await fetch(`${base}/artifacts/files`, {
    method: "POST",
    headers: headers(token),
    body: form,
  });
  return json(response);
}

async function replace(token, id, version, file) {
  const form = new FormData();
  form.append("expectedVersion", String(version));
  form.append("file", file);
  return json(
    await fetch(`${base}/artifacts/files/${id}/versions`, {
      method: "POST",
      headers: headers(token),
      body: form,
    })
  );
}

async function main() {
  const userA = `pg-artifact-a-${suffix}`;
  const userB = `pg-artifact-b-${suffix}`;
  await signup(userA, `${userA}@example.invalid`);
  await signup(userB, `${userB}@example.invalid`);
  const tokenA = await signin(userA);
  const tokenB = await signin(userB);
  record("signup/signin on PostgreSQL", { users: 2 });

  const htmlBytes = fs.readFileSync(
    path.join(fixtureRoot, "sample-artifact.html")
  );
  const pdfBytes = fs.readFileSync(
    path.join(fixtureRoot, "sample-artifact.pdf")
  );
  const pptxBytes = fs.readFileSync(
    path.join(fixtureRoot, "sample-artifact.pptx")
  );
  const html = await upload(
    tokenA,
    new File([htmlBytes], "qa-report.html", { type: "text/html" }),
    "PostgreSQL HTML 보고서"
  );
  const pdf = await upload(
    tokenA,
    new File([pdfBytes], "qa-report.pdf", { type: "application/pdf" }),
    "PostgreSQL PDF 보고서"
  );
  const pptx = await upload(
    tokenA,
    new File([pptxBytes], "qa-report.pptx", {
      type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }),
    "PostgreSQL PPTX 보고서"
  );
  created.push(html.id, pdf.id, pptx.id);
  record("HTML/PDF/PPTX upload", {
    ids: created,
    versions: [html.headVersion, pdf.headVersion, pptx.headVersion],
  });

  const list = await json(
    await fetch(`${base}/artifacts/files`, { headers: headers(tokenA) })
  );
  if (!created.every((id) => list.items.some((item) => item.id === id)))
    throw new Error("uploaded artifacts are missing from the owner list");
  const otherList = await json(
    await fetch(`${base}/artifacts/files`, { headers: headers(tokenB) })
  );
  if (otherList.items.length !== 0)
    throw new Error("other account can list artifacts");
  const denied = await fetch(`${base}/artifacts/files/${html.id}`, {
    headers: headers(tokenB),
  });
  if (denied.status !== 404)
    throw new Error(`cross-account detail returned ${denied.status}`);
  record("owner list and cross-account isolation", {
    ownerItems: list.items.length,
    otherItems: 0,
  });

  const originalContent = Buffer.from(
    await (
      await fetch(`${base}/artifacts/files/${html.id}/versions/1/content`, {
        headers: headers(tokenA),
      })
    ).arrayBuffer()
  );
  if (!originalContent.equals(htmlBytes))
    throw new Error("HTML content bytes changed");
  const pdfContentResponse = await fetch(
    `${base}/artifacts/files/${pdf.id}/versions/1/content`,
    {
      headers: headers(tokenA),
    }
  );
  const pdfContent = Buffer.from(await pdfContentResponse.arrayBuffer());
  if (!pdfContent.equals(pdfBytes))
    throw new Error("PDF content bytes changed");
  if (
    !/sandbox/.test(
      pdfContentResponse.headers.get("content-security-policy") || ""
    )
  )
    throw new Error("PDF response lacks sandbox CSP");
  const pptxContentResponse = await fetch(
    `${base}/artifacts/files/${pptx.id}/versions/1/content`,
    { headers: headers(tokenA) }
  );
  if (
    !/attachment/.test(
      pptxContentResponse.headers.get("content-disposition") || ""
    )
  )
    throw new Error("PPTX is not forced to download");
  record("byte-exact preview and download boundaries", {
    htmlSha256: createHash("sha256").update(originalContent).digest("hex"),
    pdfSha256: createHash("sha256").update(pdfContent).digest("hex"),
  });

  const replacement = Buffer.from(
    "<!doctype html><html><body><h1>PostgreSQL version 2</h1></body></html>"
  );
  const updated = await replace(
    tokenA,
    html.id,
    html.headVersion,
    new File([replacement], "qa-report.html", { type: "text/html" })
  );
  const oldAfterReplace = Buffer.from(
    await (
      await fetch(`${base}/artifacts/files/${html.id}/versions/1/content`, {
        headers: headers(tokenA),
      })
    ).arrayBuffer()
  );
  const newAfterReplace = Buffer.from(
    await (
      await fetch(`${base}/artifacts/files/${html.id}/versions/2/content`, {
        headers: headers(tokenA),
      })
    ).arrayBuffer()
  );
  if (
    !oldAfterReplace.equals(htmlBytes) ||
    !newAfterReplace.equals(replacement)
  )
    throw new Error("immutable version bytes were not preserved");
  const stale = await fetch(`${base}/artifacts/files/${html.id}/versions`, {
    method: "POST",
    headers: headers(tokenA),
    body: (() => {
      const form = new FormData();
      form.append("expectedVersion", "1");
      form.append(
        "file",
        new File([replacement], "qa-report.html", { type: "text/html" })
      );
      return form;
    })(),
  });
  if (stale.status !== 409)
    throw new Error(`stale replacement returned ${stale.status}`);
  record("version replacement and stale CAS", {
    headVersion: updated.headVersion,
    staleStatus: 409,
  });

  const badPdf = await fetch(`${base}/artifacts/files`, {
    method: "POST",
    headers: headers(tokenA),
    body: (() => {
      const form = new FormData();
      form.append(
        "file",
        new File([Buffer.from("not a pdf")], "bad.pdf", {
          type: "application/pdf",
        })
      );
      return form;
    })(),
  });
  if (badPdf.status !== 400)
    throw new Error(`invalid PDF magic returned ${badPdf.status}`);
  const mismatch = await fetch(`${base}/artifacts/files`, {
    method: "POST",
    headers: headers(tokenA),
    body: (() => {
      const form = new FormData();
      form.append(
        "file",
        new File([pdfBytes], "bad.txt", { type: "text/plain" })
      );
      return form;
    })(),
  });
  if (mismatch.status !== 400)
    throw new Error(`MIME mismatch returned ${mismatch.status}`);
  record("upload validation", { magicStatus: 400, mimeStatus: 400 });

  const shared = await json(
    await fetch(`${base}/artifacts/files/${html.id}/share`, {
      method: "POST",
      headers: { ...headers(tokenA), "content-type": "application/json" },
      body: "{}",
    })
  );
  const sharedDetail = await json(
    await fetch(`${base}/artifacts/shared/${encodeURIComponent(shared.token)}`)
  );
  const sharedContent = Buffer.from(
    await (
      await fetch(
        `${base}/artifacts/shared/${encodeURIComponent(shared.token)}/content`
      )
    ).arrayBuffer()
  );
  if (sharedDetail.headVersion !== 2 || !sharedContent.equals(replacement))
    throw new Error("anonymous share did not expose current version bytes");
  const revoke = await fetch(`${base}/artifacts/files/${html.id}/share`, {
    method: "DELETE",
    headers: headers(tokenA),
  });
  if (revoke.status !== 204)
    throw new Error(`revoke returned ${revoke.status}`);
  const revoked = await fetch(
    `${base}/artifacts/shared/${encodeURIComponent(shared.token)}`
  );
  if (revoked.status !== 404)
    throw new Error(`revoked share returned ${revoked.status}`);
  record("anonymous share and revocation", {
    sharedVersion: sharedDetail.headVersion,
    revokedStatus: 404,
  });

  const expiring = await json(
    await fetch(`${base}/artifacts/files/${pdf.id}/share`, {
      method: "POST",
      headers: { ...headers(tokenA), "content-type": "application/json" },
      body: JSON.stringify({
        expiresAt: new Date(Date.now() + 1500).toISOString(),
      }),
    })
  );
  await new Promise((resolve) => setTimeout(resolve, 2200));
  const expired = await fetch(
    `${base}/artifacts/shared/${encodeURIComponent(expiring.token)}`
  );
  if (expired.status !== 404)
    throw new Error(`expired share returned ${expired.status}`);
  record("share expiration", { expiredStatus: 404 });

  const latestHtml = await json(
    await fetch(`${base}/artifacts/files/${html.id}`, {
      headers: headers(tokenA),
    })
  );
  const deleted = await fetch(`${base}/artifacts/files/${html.id}`, {
    method: "DELETE",
    headers: { ...headers(tokenA), "content-type": "application/json" },
    body: JSON.stringify({ expectedRevision: latestHtml.revision }),
  });
  if (deleted.status !== 204)
    throw new Error(`delete returned ${deleted.status}`);
  const deletedDetail = await fetch(`${base}/artifacts/files/${html.id}`, {
    headers: headers(tokenA),
  });
  if (deletedDetail.status !== 404)
    throw new Error(`deleted artifact returned ${deletedDetail.status}`);
  record("soft delete", { deleteStatus: 204, detailStatus: 404 });

  const result = {
    verdict: "VERIFIED",
    checkedAt: new Date().toISOString(),
    checks,
    activeArtifactIds: [html.id, pdf.id, pptx.id],
  };
  fs.writeFileSync(
    path.join(evidence, "api-result.json"),
    JSON.stringify(result, null, 2),
    {
      mode: 0o600,
    }
  );
  process.stdout.write(JSON.stringify(result) + "\n");
}

main().catch((error) => {
  const failure = {
    verdict: "FAILED",
    message: error.message,
    stack: error.stack,
    checks,
  };
  fs.writeFileSync(
    path.join(evidence, "api-result.json"),
    JSON.stringify(failure, null, 2),
    {
      mode: 0o600,
    }
  );
  process.stderr.write(JSON.stringify(failure) + "\n");
  process.exitCode = 1;
});
