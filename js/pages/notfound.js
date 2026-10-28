import { t } from '../i18n.js';
import { setMeta, pageReady } from '../layout.js';

setMeta({ title: t('404.title'), description: t('404.text') });
document.getElementById('main').innerHTML = `<div class="container nf">
  <p class="big" aria-hidden="true">404</p>
  <h1>${t('404.title')}</h1>
  <p style="color:var(--muted);margin:10px auto 24px;max-width:40ch">${t('404.text')}</p>
  <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap"><a class="btn btn-primary" href="shop.html">${t('404.cta')}</a><a class="btn btn-outline" href="index.html">${t('common.back_home')}</a></div>
</div>`;

pageReady();
