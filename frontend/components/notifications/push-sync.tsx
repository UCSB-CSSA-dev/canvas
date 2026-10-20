"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { currentSubscription, forgetDevice, subscriptionArgs, usePushState } from "@/lib/push";

/** Re-saves this device's push subscription on load, since browsers can rotate or drop it. */
export function PushSync() {
  const state = usePushState();
  const save = useMutation(api.push.subscribe);

  useEffect(() => {
    if (state !== "on") return;
    let cancelled = false;
    void (async () => {
      const subscription = await currentSubscription();
      if (cancelled) return;
      if (subscription) await save(subscriptionArgs(subscription));
      else forgetDevice();
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state, save]);

  return null;
}
