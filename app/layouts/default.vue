<template>
  <div class="flex min-h-screen flex-col">
    <NuxtLoadingIndicator color="#ff0033" />
    <AppHeader />
    <main class="flex-1">
      <slot />
    </main>
    <AppFooter />
    <ToastHost />
  </div>
</template>
