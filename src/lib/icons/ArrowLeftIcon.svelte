<script>
  // Default params
  let { strokeColor = "currentColor", width = "1em", height = "1em", className = "size-6" } = $props();
</script>

<svg {width} {height} class={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M15 5L9 12L15 19" stroke={strokeColor} stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
</svg>
