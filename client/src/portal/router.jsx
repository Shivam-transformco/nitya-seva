import { useEffect, useState } from "react";

// Hash routes (#/pledges/123) need no server rewrites on static hosting.

function readHash() {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [path, search = ""] = raw.split("?");
  return { path: path || "/", params: new URLSearchParams(search) };
}

export function useRoute() {
  const [route, setRoute] = useState(readHash);
  useEffect(() => {
    const onChange = () => {
      setRoute(readHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to) {
  window.location.hash = to;
}

export function Link({ to, ...props }) {
  return <a href={`#${to}`} {...props} />;
}
