import { useQuery } from "@tanstack/react-query";

export const aiCreditsQueryKey = ["ai-credits"] as const;

export const aiCreditCosts = {
  generate: 3,
  "improve-project": 2,
  "refine-copy": 1,
} as const;

export type AiCreditOperation = keyof typeof aiCreditCosts;

export function canAffordAiOperation(
  available: number | undefined,
  operation: AiCreditOperation,
) {
  return available !== undefined && available >= aiCreditCosts[operation];
}

export async function reserveAiCredits(
  operation: AiCreditOperation,
  requestId: string,
) {
  const response = await fetch("/api/ai/credits", {
    body: JSON.stringify({
      action: "reserve",
      operation,
      requestId,
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? "credits_unavailable");
  }
}

export async function finalizeAiCredits(
  requestId: string,
  status: "committed" | "refunded",
) {
  await fetch("/api/ai/credits", {
    body: JSON.stringify({ action: "complete", requestId, status }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
}

export type AiCreditBalance = {
  available: number;
  consumed: number;
  monthly: number;
  refunded: number;
};

async function fetchAiCredits(): Promise<AiCreditBalance> {
  const response = await fetch("/api/ai/credits");
  if (!response.ok) throw new Error("credits_unavailable");
  return (await response.json()) as AiCreditBalance;
}

export function useAiCredits() {
  return useQuery({
    queryKey: aiCreditsQueryKey,
    queryFn: fetchAiCredits,
    staleTime: 5 * 60_000,
  });
}
