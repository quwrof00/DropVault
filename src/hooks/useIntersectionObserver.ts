import { useEffect, useState } from "react";

export function useIntersectionObserver(options: IntersectionObserverInit = {}) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [target, setTarget] = useState<Element | null>(null);

  useEffect(() => {
    if (!target) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);

    observer.observe(target);

    return () => {
      observer.unobserve(target);
    };
  }, [target, options.root, options.rootMargin, options.threshold]);

  return { targetRef: setTarget, isIntersecting };
}
