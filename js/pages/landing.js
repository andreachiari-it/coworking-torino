// js/pages/landing.js — teaser pubblico + flusso di login OTP + onboarding.
import { el, render } from '../ui/dom.js';
import { showError } from '../ui/toast.js';
import {
  sendOtp,
  verifyOtp,
  getSession,
  getCurrentProfile,
  needsOnboarding,
  resendCooldownSeconds,
} from '../auth.js';
import { supabase } from '../supabase.js';
import { request } from '../lib/request.js';
import { getPublicTeaser } from '../api/spaces.js';
import { WHATSAPP_GROUP_URL } from '../config.js';

const STEPS = ['email', 'code', 'onboarding', 'already-in'];
let currentEmail = '';
let resendTimerId = null;

function getNextUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('next') || 'app.html';
}

function showStep(name) {
  for (const step of STEPS) {
    const section = document.getElementById(`step-${step}`);
    if (section) section.hidden = step !== name;
  }
}

// --- Teaser pubblico -------------------------------------------------------

async function initTeaser() {
  const teaser = await getPublicTeaser();
  const countSpaces = document.getElementById('teaser-count-spaces');
  const countFree = document.getElementById('teaser-count-free');
  const countZones = document.getElementById('teaser-count-zones');
  const samplesList = document.getElementById('teaser-samples');

  if (!teaser) {
    if (countSpaces) countSpaces.textContent = '—';
    return;
  }

  if (countSpaces) countSpaces.textContent = teaser.spaces_count ?? '—';
  if (countFree) countFree.textContent = teaser.free_count ?? '—';
  if (countZones) countZones.textContent = teaser.zones_count ?? '—';

  if (samplesList && Array.isArray(teaser.sample_spaces) && teaser.sample_spaces.length > 0) {
    render(
      samplesList,
      teaser.sample_spaces.map((space) =>
        el('li', { className: 'teaser-sample' }, [
          el('span', { className: 'teaser-sample-name' }, space.name),
          el('span', { className: 'teaser-sample-meta' }, [space.type, space.zone].filter(Boolean).join(' · ')),
        ])
      )
    );
  }
}

// --- OTP: step email ---------------------------------------------------

function initEmailStep() {
  const form = document.getElementById('otp-email-form');
  const input = document.getElementById('otp-email');
  const submitBtn = document.getElementById('otp-email-submit');

  const params = new URLSearchParams(window.location.search);
  const prefill = params.get('email');
  if (prefill) input.value = prefill;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Invio in corso...';

    const { error } = await sendOtp(email);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Invia il codice';

    if (error) {
      showError('Non sono riuscito a inviare il codice. Controlla l’indirizzo e riprova.');
      return;
    }

    currentEmail = email;
    document.getElementById('code-step-email').textContent = email;
    showStep('code');
    startResendCooldown();
    document.getElementById('otp-code').focus();
  });
}

// --- OTP: step codice ----------------------------------------------------

function startResendCooldown() {
  const button = document.getElementById('otp-resend');
  const timerLabel = document.getElementById('otp-resend-timer');
  let remaining = resendCooldownSeconds;

  button.disabled = true;
  window.clearInterval(resendTimerId);

  const tick = () => {
    if (remaining <= 0) {
      window.clearInterval(resendTimerId);
      button.disabled = false;
      timerLabel.textContent = '';
      return;
    }
    timerLabel.textContent = `Puoi rinviarlo tra ${remaining}s`;
    remaining -= 1;
  };

  tick();
  resendTimerId = window.setInterval(tick, 1000);
}

async function handleVerify(code) {
  const errorEl = document.getElementById('otp-error');
  errorEl.textContent = '';

  if (!/^\d{6}$/.test(code)) {
    errorEl.textContent = 'Il codice deve avere 6 cifre.';
    return;
  }

  const submitBtn = document.getElementById('otp-code-submit');
  submitBtn.disabled = true;

  const { error } = await verifyOtp(currentEmail, code);

  submitBtn.disabled = false;

  if (error) {
    errorEl.textContent = 'Codice errato o scaduto. Controlla e riprova, oppure chiedine uno nuovo.';
    return;
  }

  await afterLogin();
}

function initCodeStep() {
  const form = document.getElementById('otp-code-form');
  const input = document.getElementById('otp-code');
  const resendBtn = document.getElementById('otp-resend');
  const changeEmailBtn = document.getElementById('otp-change-email');

  input.addEventListener('input', () => {
    input.value = input.value.replace(/\D/g, '').slice(0, 6);
    if (input.value.length === 6) {
      handleVerify(input.value);
    }
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    handleVerify(input.value);
  });

  resendBtn.addEventListener('click', async () => {
    const { error } = await sendOtp(currentEmail);
    if (error) {
      showError('Non sono riuscito a rinviare il codice. Riprova tra poco.');
      return;
    }
    startResendCooldown();
  });

  changeEmailBtn.addEventListener('click', () => {
    window.clearInterval(resendTimerId);
    showStep('email');
  });
}

// --- Onboarding (primo accesso) ------------------------------------------

function initOnboardingStep() {
  const form = document.getElementById('onboarding-form');
  const joinCta = document.getElementById('whatsapp-join-cta');

  document.getElementById('whatsapp-join-link').href = WHATSAPP_GROUP_URL;

  for (const radio of form.querySelectorAll('input[name="whatsapp-member"]')) {
    radio.addEventListener('change', () => {
      joinCta.hidden = radio.value !== 'no' || !radio.checked;
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const displayNameInput = document.getElementById('display-name');
    const displayName = displayNameInput.value.trim();
    const errorEl = document.getElementById('onboarding-error');
    errorEl.textContent = '';

    if (!displayName) {
      errorEl.textContent = 'Dicci come vuoi essere chiamato/a nel gruppo.';
      displayNameInput.focus();
      return;
    }
    if (!document.getElementById('privacy-accept').checked) {
      errorEl.textContent = 'Per continuare devi leggere e accettare la privacy.';
      return;
    }

    const whatsappMember = form.querySelector('input[name="whatsapp-member"]:checked')?.value === 'si';
    const showInCheckins = document.getElementById('show-in-checkins').checked;

    const session = await getSession();
    if (!session) {
      showError('La sessione è scaduta. Rifai l’accesso.');
      showStep('email');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const { error } = await request(() =>
      supabase
        .from('profiles')
        .update({
          display_name: displayName,
          whatsapp_member: whatsappMember,
          show_in_checkins: showInCheckins,
        })
        .eq('id', session.user.id)
    );

    submitBtn.disabled = false;

    if (error) return;

    window.location.href = getNextUrl();
  });
}

// --- Orchestrazione --------------------------------------------------------

async function afterLogin() {
  window.clearInterval(resendTimerId);

  let profile = await getCurrentProfile();
  for (let attempt = 0; attempt < 3 && !profile; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 300));
    profile = await getCurrentProfile();
  }

  if (needsOnboarding(profile)) {
    showStep('onboarding');
    document.getElementById('display-name').focus();
    return;
  }

  window.location.href = getNextUrl();
}

async function initAuthFlow() {
  initEmailStep();
  initCodeStep();
  initOnboardingStep();

  const session = await getSession();
  if (!session) {
    showStep('email');
    return;
  }

  const profile = await getCurrentProfile();
  if (needsOnboarding(profile)) {
    showStep('onboarding');
    return;
  }

  document.getElementById('already-in-link').href = getNextUrl();
  showStep('already-in');
}

document.getElementById('whatsapp-cta').href = WHATSAPP_GROUP_URL;

initTeaser();
initAuthFlow();

if (window.location.hash === '#accedi') {
  document.getElementById('accedi')?.scrollIntoView({ behavior: 'smooth' });
}
