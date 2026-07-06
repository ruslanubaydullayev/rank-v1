<script setup lang="ts">
definePageMeta({ layout: "default" });

useSeoMeta({
  title: "Sign in — Ranking Shorts",
  robots: "noindex, nofollow",
});

const route = useRoute();
const { loggedIn } = useUserSession();

// If already signed in, bounce to the intended destination.
onMounted(() => {
  if (loggedIn.value) {
    navigateTo((route.query.redirect as string) || "/create");
  }
});

const errored = computed(() => route.query.error === "oauth");

function signIn() {
  const redirect = (route.query.redirect as string) || "/create";
  // Remembered server-side after the OAuth round-trip.
  useCookie("post_login_redirect", { maxAge: 600, path: "/" }).value = redirect;
  window.location.href = "/api/auth/google";
}
</script>

<template>
  <div class="mx-auto flex max-w-md flex-col items-center px-4 py-24 sm:px-6">
    <div
      class="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-lg font-black"
    >
      RS
    </div>
    <h1 class="mt-6 text-3xl font-bold">Sign in to Ranking Shorts</h1>
    <p class="mt-2 text-center text-muted">
      Sign in to create ranking videos and manage your subscription.
    </p>

    <p
      v-if="errored"
      class="mt-6 w-full rounded-xl border border-red-600/50 bg-red-950/40 px-4 py-3 text-sm text-red-200"
    >
      Sign-in failed. Please try again.
    </p>

    <button
      class="mt-8 flex w-full items-center justify-center gap-3 rounded-full bg-white px-6 py-3 font-semibold text-neutral-900 transition hover:bg-neutral-100"
      @click="signIn"
    >
      <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
        <path
          fill="#4285F4"
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
        />
        <path
          fill="#34A853"
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
        />
        <path
          fill="#FBBC05"
          d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
        />
        <path
          fill="#EA4335"
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38Z"
        />
      </svg>
      Continue with Google
    </button>

    <p class="mt-6 text-center text-xs text-muted">
      By continuing you agree to our
      <a href="/terms" class="underline">Terms</a> and
      <a href="/privacy" class="underline">Privacy Policy</a>.
    </p>
  </div>
</template>
