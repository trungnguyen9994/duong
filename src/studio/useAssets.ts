import { useEffect, useState } from "react";
import { api } from "./client";
import type { Asset } from "./StudioApp";
export function useAssets(initialAssets?: Asset[]) {
  const [assets, setAssets] = useState(initialAssets || []);
  useEffect(() => {
    if (initialAssets) {
      setAssets(initialAssets);
      return;
    }
    let active = true;
    const load = () =>
      void api<Asset[]>("/assets")
        .then((rows) => {
          if (active) setAssets(rows);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 240000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [initialAssets]);
  return assets;
}
