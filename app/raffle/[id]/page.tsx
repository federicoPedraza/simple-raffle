'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { Id } from '../../../convex/_generated/dataModel';
import RaffleContent from '../../components/RaffleContent';

export default function RafflePage() {
  const params = useParams();
  const router = useRouter();
  const raffleId = params.id as Id<'raffles'>;

  const [sellerId, setSellerId] = useState<Id<'sellers'> | null>(null);

  // Check localStorage on mount
  useEffect(() => {
    const storedSellerId = localStorage.getItem('sellerId');
    if (storedSellerId) {
      setSellerId(storedSellerId as Id<'sellers'>);
    } else {
      router.push('/');
    }
  }, [router]);

  // Check if seller has access to this raffle
  const sellerRole = useQuery(
    api.raffles.getSellerRole,
    sellerId && raffleId ? { sellerId, raffleId } : 'skip'
  );

  // Redirect if no access
  useEffect(() => {
    if (sellerId && raffleId && sellerRole === null && sellerRole !== undefined) {
      // User doesn't have access, redirect to home
      router.push('/');
    }
  }, [sellerId, raffleId, sellerRole, router]);

  if (!sellerId || sellerRole === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-zinc-600 dark:text-zinc-400">Cargando...</p>
      </div>
    );
  }

  return <RaffleContent raffleId={raffleId} sellerId={sellerId} />;
}
