/**
 * Script que fija la clase light/dark ANTES de pintar (evita parpadeo).
 * Se inyecta desde el layout (componente de servidor), nunca desde un componente
 * de cliente: React 19 avisa si se renderiza un <script> en el cliente.
 * Usa la misma clave de localStorage ("theme") que usaba next-themes.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"&&t!=="system")t="system";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.remove("light","dark");r.classList.add(d?"dark":"light");r.style.colorScheme=d?"dark":"light"}catch(e){}})()`
