import { useQuery } from "@tanstack/react-query";

export const aiCreditsQueryKey = ["ai-credits"] as const;

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
