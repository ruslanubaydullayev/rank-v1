<script setup lang="ts">
const { loggedIn, user, clear } = useUserSession();
const router = useRouter();
const open = ref(false);

async function logout() {
  await $fetch("/api/auth/logout", { method: "POST" });
  await clear();
  open.value = false;
  await router.push("/");
}
</script>

<template>
  <header
    class="sticky top-0 z-50 border-b border-border bg-bg/85 backdrop-blur"
  >
    <div
      class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6"
    >
      <NuxtLink to="/" class="flex items-center gap-2 font-bold tracking-tight">
        <span
          class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-black text-white"
          >RS</span
        >
        <span class="text-lg">Ranking Shorts</span>
      </NuxtLink>

      <nav class="hidden items-center gap-1 md:flex">
        <NuxtLink to="/pricing" class="btn-ghost">Pricing</NuxtLink>
        <NuxtLink to="/blog" class="btn-ghost">Blog</NuxtLink>
        <NuxtLink to="/create" class="btn-ghost">Create</NuxtLink>
        <template v-if="loggedIn">
          <NuxtLink to="/account" class="btn-ghost flex items-center gap-2">
            <img
              v-if="user?.avatarUrl"
              :src="user.avatarUrl"
              alt=""
              class="h-6 w-6 rounded-full"
              referrerpolicy="no-referrer"
            />
            <span>Account</span>
          </NuxtLink>
          <button class="btn-outline" @click="logout">Sign out</button>
        </template>
        <template v-else>
          <NuxtLink to="/login" class="btn-primary">Sign in</NuxtLink>
        </template>
      </nav>

      <button
        class="btn-ghost md:hidden"
        aria-label="Toggle menu"
        @click="open = !open"
      >
        <span aria-hidden>{{ open ? "✕" : "☰" }}</span>
      </button>
    </div>

    <Transition name="fade-slide">
      <div v-if="open" class="border-t border-border px-4 py-3 md:hidden">
        <div class="flex flex-col gap-1">
          <NuxtLink to="/pricing" class="btn-ghost" @click="open = false"
            >Pricing</NuxtLink
          >
          <NuxtLink to="/blog" class="btn-ghost" @click="open = false"
            >Blog</NuxtLink
          >
          <NuxtLink to="/create" class="btn-ghost" @click="open = false"
            >Create</NuxtLink
          >
          <NuxtLink
            v-if="loggedIn"
            to="/account"
            class="btn-ghost"
            @click="open = false"
            >Account</NuxtLink
          >
          <button v-if="loggedIn" class="btn-outline" @click="logout">
            Sign out
          </button>
          <NuxtLink v-else to="/login" class="btn-primary" @click="open = false"
            >Sign in</NuxtLink
          >
        </div>
      </div>
    </Transition>
  </header>
</template>
