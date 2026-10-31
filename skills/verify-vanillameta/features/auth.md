# Authentication and session

## Sub-features
Login with userId/password, token issuance, logout, invalid credentials rejected.

## How to get to it (user POV)
Open /login, enter credentials, submit.

## Driving it with Playwright
POST /v1/login/signin with {"userId":"guest","password":"Admin!@12"} and assert accessToken exists. UI: fill the two labeled fields and click Login.

## Gotchas
The local seed user has no organization. Create one before organization-scoped journeys.
`127.0.0.1:3000` and `localhost:4000` are different browser origins; the local API accepts both,
but login UI must distinguish a transport/CORS failure from a 401. Verify a successful sign-in
with the observed 201 response and stored token at `127.0.0.1:3000`.

