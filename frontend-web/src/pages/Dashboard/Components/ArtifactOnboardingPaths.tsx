import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Building2, Plug } from 'lucide-react';

export default function ArtifactOnboardingPaths() {
  const { t } = useTranslation();
  const pathClass =
    'group flex min-w-0 items-start gap-3 rounded-lg border border-border bg-background p-4 text-inherit no-underline transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

  return (
    <section
      aria-labelledby="artifact-onboarding-title"
      className="mb-5 rounded-xl border border-border bg-muted/30 p-4 sm:p-5"
    >
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{t('artifact.onboardingStep')}</p>
      <h2 id="artifact-onboarding-title" className="mt-1 text-lg font-semibold">
        {t('artifact.onboardingTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('artifact.onboardingHint')}</p>
      <div className="mt-4 grid min-w-0 gap-3 md:grid-cols-2">
        <Link to="/organization" className={pathClass} aria-label={t('artifact.onboardingOrganizationTitle')}>
          <Building2 className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t('artifact.onboardingOrganizationTitle')}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t('artifact.onboardingOrganizationHint')}</span>
          </span>
          <ArrowRight className="mt-1 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </Link>
        <Link to="/ai-connections" className={pathClass} aria-label={t('artifact.onboardingAiTitle')}>
          <Plug className="mt-0.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{t('artifact.onboardingAiTitle')}</span>
            <span className="mt-1 block text-sm text-muted-foreground">{t('artifact.onboardingAiHint')}</span>
          </span>
          <ArrowRight className="mt-1 shrink-0 text-muted-foreground group-hover:text-foreground" />
        </Link>
      </div>
    </section>
  );
}
