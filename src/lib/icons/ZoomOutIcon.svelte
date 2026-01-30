<script>
  // Default params
  let { strokeColor = "currentColor", width = "1em", height = "1em", className = "size-6" } = $props();
</script>

<svg {width} {height} class={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="11.5" cy="11.5" r="9.5" stroke={strokeColor} stroke-width="1.5" />
  <path d="M9 11.5H11.5H14" stroke={strokeColor} stroke-width="1.5" stroke-linecap="round" />
  <path d="M20 20L22 22" stroke={strokeColor} stroke-width="1.5" stroke-linecap="round" />
</svg>
