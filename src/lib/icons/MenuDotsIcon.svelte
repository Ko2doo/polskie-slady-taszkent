<script>
  // Default params
  let { strokeColor = "currentColor", width = "1em", height = "1em", className = "w-6 h-6" } = $props();
</script>

<svg {width} {height} class={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="5" cy="12" r="2" stroke={strokeColor} stroke-width="1.5" />
  <circle cx="12" cy="12" r="2" stroke={strokeColor} stroke-width="1.5" />
  <circle cx="19" cy="12" r="2" stroke={strokeColor} stroke-width="1.5" />
</svg>
