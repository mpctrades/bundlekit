// Imported (not a /public static file) so Vite emits it under /assets/ with
// the rest of the built bundle — the reverse proxy in front of this app only
// routes known prefixes to Node, and /assets/ is one of them. A bare root
// path like /logo-icon.png 404s in production (same gap as /privacy).
import logoIconUrl from "../assets/logo-icon.png";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span
      style={{
        width: size,
        height: size,
        minWidth: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <img
        src={logoIconUrl}
        alt="BundleKit"
        width={size}
        height={size}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </span>
  );
}
