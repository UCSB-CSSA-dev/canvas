"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { currentSubscription, forgetDevice, matchesKey, subscriptionArgs, usePushState } from "@/lib/push";

/**
 * Re-saves this device's push subscription on load, since browsers can rotate or drop it. A
 * subscription made with another VAPID key (e.g. against the dev deployment) can never receive
 * this deployment's pushes, so it is dropped and the device shows as off until re-enabled.
 */
export function PushSync() {
  const state = usePushState();
  const config = useQuery(api.push.config);
  const save = useMutation(api.push.subscribe);
  const remove = useMutation(api.push.unsubscribe);
  const publicKey = config?.publicKey;

  useEffect(() => {
    if (state !== "on" || config === undefined) return;
    let cancelled = false;
    void (async () => {
      const subscription = await currentSubscription();
      if (cancelled) return;
      if (!subscription) {
        forgetDevice();
      } else if (!publicKey || !matchesKey(subscription, publicKey)) {
        await remove({ endpoint: subscription.endpoint }).catch(() => {});
        await subscription.unsubscribe();
        forgetDevice();
      } else {
        await save(subscriptionArgs(subscription));
      }
    })().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [state, config, publicKey, save, remove]);

  return null;
}
