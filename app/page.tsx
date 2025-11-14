'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../convex/_generated/api';
import { Id } from '../convex/_generated/dataModel';

export default function Home() {
  // Auth state
  const [sellerId, setSellerId] = useState<Id<'sellers'> | null>(null);
  const [sellerName, setSellerName] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showAuth, setShowAuth] = useState(true);

  // Raffle state
  const [selectedRaffleId, setSelectedRaffleId] = useState<Id<'raffles'> | null>(null);
  const [showCreateRaffle, setShowCreateRaffle] = useState(false);
  const [showJoinRaffle, setShowJoinRaffle] = useState(false);
  const [selectedRaffleToJoin, setSelectedRaffleToJoin] = useState<Id<'raffles'> | null>(null);

  // Create raffle form
  const [raffleAmount, setRaffleAmount] = useState('');
  const [rafflePrice, setRafflePrice] = useState('');
  const [sellerSearchTerm, setSellerSearchTerm] = useState('');
  const [selectedSellers, setSelectedSellers] = useState<Array<{ id: Id<'sellers'>; name: string; role: 'owner' | 'moderator' | 'seller' }>>([]);

  // Number registration form
  const [numero, setNumero] = useState('');
  const [nombre, setNombre] = useState('');
  const [contacto, setContacto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 20;

  // Chat state
  const [chatMessage, setChatMessage] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  // Manage sellers modal state
  const [showManageSellers, setShowManageSellers] = useState(false);
  const [sellerSearchManage, setSellerSearchManage] = useState('');
  const [selectedSellerToAdd, setSelectedSellerToAdd] = useState<Id<'sellers'> | null>(null);
  const [newSellerRole, setNewSellerRole] = useState<'owner' | 'moderator' | 'seller'>('seller');

  // Revenue calculation state
  const [revenue, setRevenue] = useState<number | null>(null);

  // Convex queries
  const seller = useQuery(api.auth.getSeller, sellerId ? { sellerId } : 'skip');
  const raffles = useQuery(api.raffles.getRafflesBySeller, sellerId ? { sellerId } : 'skip');
  const selectedRaffle = useQuery(api.raffles.getRaffle, selectedRaffleId ? { raffleId: selectedRaffleId } : 'skip');
  const sellerRole = useQuery(
    api.raffles.getSellerRole,
    sellerId && selectedRaffleId ? { sellerId, raffleId: selectedRaffleId } : 'skip'
  );
  const searchResults = useQuery(
    api.numbers.searchNumbers,
    selectedRaffleId
      ? {
        raffleId: selectedRaffleId,
        searchTerm: busquedaDebounced || undefined,
        paginationOpts: {
          numItems: itemsPerPage,
          cursor: (currentPage * itemsPerPage).toString(),
        },
      }
      : 'skip'
  );

  // Convex queries
  const foundSeller = useQuery(
    api.auth.findSellerByName,
    sellerName.trim() && isLoginMode ? { name: sellerName.trim() } : 'skip'
  );

  // Convex mutations
  const createSeller = useMutation(api.auth.createSeller);
  const createRaffle = useMutation(api.raffles.createRaffle);
  const registerNumber = useMutation(api.numbers.registerNumber);
  const updateRaffleState = useMutation(api.raffles.updateRaffleState);
  const searchSellers = useQuery(api.raffles.searchSellers, { searchTerm: sellerSearchTerm });
  const assignSellerToRaffle = useMutation(api.raffles.assignSellerToRaffle);
  const removeSellerFromRaffle = useMutation(api.raffles.removeSellerFromRaffle);
  const raffleSellers = useQuery(
    api.raffles.getSellersByRaffle,
    selectedRaffleId ? { raffleId: selectedRaffleId } : 'skip'
  );
  const searchSellersForManage = useQuery(
    api.raffles.searchSellers,
    { searchTerm: sellerSearchManage }
  );
  const allRaffleNumbers = useQuery(
    api.numbers.getNumbersByRaffle,
    selectedRaffleId ? { raffleId: selectedRaffleId } : 'skip'
  );
  const chatMessages = useQuery(
    api.chat.getMessages,
    selectedRaffleId && sellerId
      ? { raffleId: selectedRaffleId, sellerId }
      : 'skip'
  );
  const sendChatMessage = useMutation(api.chat.sendMessage);

  // Check localStorage on mount
  useEffect(() => {
    const storedSellerId = localStorage.getItem('sellerId');
    if (storedSellerId) {
      setSellerId(storedSellerId as Id<'sellers'>);
      setShowAuth(false);
    }
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
      setCurrentPage(0); // Reset to first page on new search
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Handle login/create seller
  useEffect(() => {
    if (isLoginMode && sellerName.trim() && foundSeller) {
      setSellerId(foundSeller._id);
      localStorage.setItem('sellerId', foundSeller._id);
      setShowAuth(false);
      setSellerName('');
    }
  }, [foundSeller, isLoginMode, sellerName]);

  const handleAuth = async () => {
    if (!sellerName.trim()) return;

    if (isLoginMode) {
      // Query will handle login via useEffect above
      if (foundSeller === null) {
        alert('Vendedor no encontrado. ¿Deseas crear uno nuevo?');
      }
    } else {
      const newSellerId = await createSeller({ name: sellerName.trim() });
      setSellerId(newSellerId);
      localStorage.setItem('sellerId', newSellerId);
      setShowAuth(false);
      setSellerName('');
    }
  };

  // Handle create raffle
  const handleCreateRaffle = async () => {
    if (!raffleAmount.trim() || !rafflePrice.trim() || !sellerId || !seller) return;

    const amount = parseInt(raffleAmount);
    const price = parseFloat(rafflePrice);

    if (isNaN(amount) || isNaN(price) || amount <= 0 || price <= 0) {
      alert('Cantidad y precio deben ser números válidos mayores a 0');
      return;
    }

    // Ensure current seller is included as owner
    const sellersToAdd = [...selectedSellers];
    const currentSellerInList = sellersToAdd.find((s) => s.id === sellerId);
    if (!currentSellerInList) {
      sellersToAdd.unshift({ id: sellerId, name: seller.name, role: 'owner' });
    } else {
      // Ensure creator is owner
      sellersToAdd.forEach((s) => {
        if (s.id === sellerId) s.role = 'owner';
      });
    }

    if (sellersToAdd.length === 0) {
      alert('Debes asignar al menos un vendedor');
      return;
    }

    try {
      const sellerIds = sellersToAdd.map((s) => s.id);
      const roles = sellersToAdd.map((s) => s.role);
      const raffleId = await createRaffle({
        amountOfNumbers: amount,
        price,
        createdBy: sellerId,
        sellerIds,
        roles,
      });

      setSelectedRaffleId(raffleId);
      setShowCreateRaffle(false);
      setRaffleAmount('');
      setRafflePrice('');
      setSelectedSellers([]);
      setSellerSearchTerm('');
    } catch (error) {
      alert('Error al crear la rifa: ' + (error as Error).message);
    }
  };

  // Handle add seller to raffle creation
  const handleAddSeller = (seller: { _id: Id<'sellers'>; name: string }) => {
    if (!selectedSellers.find((s) => s.id === seller._id)) {
      setSelectedSellers([
        ...selectedSellers,
        { id: seller._id, name: seller.name, role: 'seller' },
      ]);
    }
    setSellerSearchTerm('');
  };

  // Handle remove seller from raffle creation
  const handleRemoveSeller = (sellerId: Id<'sellers'>) => {
    setSelectedSellers(selectedSellers.filter((s) => s.id !== sellerId));
  };

  // Handle change seller role
  const handleChangeSellerRole = (sellerId: Id<'sellers'>, role: 'owner' | 'moderator' | 'seller') => {
    setSelectedSellers(
      selectedSellers.map((s) => (s.id === sellerId ? { ...s, role } : s))
    );
  };

  // Handle register number
  const handleRegisterNumber = async () => {
    if (!numero.trim() || !nombre.trim() || !contacto.trim() || !selectedRaffleId || !sellerId) {
      alert('Completa todos los campos');
      return;
    }

    try {
      await registerNumber({
        number: numero.trim(),
        raffleId: selectedRaffleId,
        sellerId,
        buyerName: nombre.trim(),
        buyerContact: contacto.trim(),
      });
      setNumero('');
      setNombre('');
      setContacto('');
      setCurrentPage(0); // Refresh list
    } catch (error) {
      alert('Error al registrar número: ' + (error as Error).message);
    }
  };

  // Handle number input (numbers only)
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setNumero(value);
    }
  };

  // Handle end raffle
  const handleEndRaffle = async () => {
    if (!selectedRaffleId || !sellerId) return;
    if (!confirm('¿Estás seguro de que deseas finalizar esta rifa?')) return;

    try {
      await updateRaffleState({
        raffleId: selectedRaffleId,
        state: 'complete',
        sellerId,
      });
      alert('Rifa finalizada');
    } catch (error) {
      alert('Error: ' + (error as Error).message);
    }
  };

  // Handle send chat message
  const handleSendChatMessage = async () => {
    if (!chatMessage.trim() || !selectedRaffleId || !sellerId) return;

    try {
      await sendChatMessage({
        raffleId: selectedRaffleId,
        sellerId,
        message: chatMessage.trim(),
      });
      setChatMessage('');
    } catch (error) {
      alert('Error al enviar mensaje: ' + (error as Error).message);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatOpen && chatMessages) {
      const chatContainer = document.getElementById('chat-messages');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }
  }, [chatMessages, chatOpen]);

  // Handle add seller to raffle
  const handleAddSellerToRaffle = async () => {
    if (!selectedSellerToAdd || !selectedRaffleId || !sellerId) return;

    try {
      await assignSellerToRaffle({
        sellerId: selectedSellerToAdd,
        raffleId: selectedRaffleId,
        role: newSellerRole,
        requesterId: sellerId,
      });
      setSelectedSellerToAdd(null);
      setSellerSearchManage('');
      setNewSellerRole('seller');
    } catch (error) {
      alert('Error al agregar vendedor: ' + (error as Error).message);
    }
  };

  // Handle remove seller from raffle
  const handleRemoveSellerFromRaffle = async (sellerIdToRemove: Id<'sellers'>) => {
    if (!selectedRaffleId || !sellerId) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este vendedor de la rifa?')) return;

    try {
      await removeSellerFromRaffle({
        sellerId: sellerIdToRemove,
        raffleId: selectedRaffleId,
        requesterId: sellerId,
      });
    } catch (error) {
      alert('Error al eliminar vendedor: ' + (error as Error).message);
    }
  };

  // Handle calculate revenue
  const handleCalculateRevenue = () => {
    if (!selectedRaffle || !allRaffleNumbers) return;

    const numberOfNumbers = allRaffleNumbers.length;
    const totalRevenue = numberOfNumbers * selectedRaffle.price;
    setRevenue(totalRevenue);
  };

  // Auth Screen
  if (showAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
        <div className="w-full max-w-md px-4">
          <div className="bg-white dark:bg-zinc-900 rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-semibold mb-4 text-black dark:text-zinc-50">
              {isLoginMode ? 'Iniciar Sesión' : 'Crear Vendedor'}
            </h2>
            <input
              type="text"
              placeholder="Nombre del vendedor"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400 mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAuth}
                className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors"
              >
                {isLoginMode ? 'Iniciar Sesión' : 'Crear'}
              </button>
              <button
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
              >
                {isLoginMode ? 'Crear Nuevo' : 'Iniciar Sesión'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Screen - No raffle selected
  if (!selectedRaffleId) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-zinc-50 dark:bg-black">
        <main className="flex w-full max-w-2xl flex-col items-center px-4 py-8">
          {/* Header with Logout */}
          <div className="w-full mb-6">
            <div className="flex justify-between items-center mb-4">
              <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
                Hola, {seller?.name}
              </h1>
              <button
                onClick={() => {
                  localStorage.removeItem('sellerId');
                  setSellerId(null);
                  setShowAuth(true);
                }}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>

          {/* List of Raffles */}
          {raffles && raffles.length > 0 && (
            <div className="w-full mb-6">
              <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
                Mis Rifas
              </h2>
              <div className="space-y-2">
                {raffles.map((raffle: any) => (
                  <button
                    key={raffle._id}
                    onClick={() => {
                      setSelectedRaffleToJoin(raffle._id);
                      setShowJoinRaffle(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${selectedRaffleToJoin === raffle._id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                      }`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-black dark:text-zinc-50">
                          Rifa - {raffle.amountOfNumbers} números
                        </p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          Precio: ${raffle.price} | Estado: {raffle.state}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                        {raffle.role}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="w-full flex gap-4 mb-8">
            <button
              onClick={() => {
                setShowCreateRaffle(true);
                setShowJoinRaffle(false);
                setSelectedRaffleToJoin(null);
              }}
              className="flex-1 px-6 py-4 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
            >
              Crear Rifa
            </button>
            <button
              onClick={() => {
                if (selectedRaffleToJoin) {
                  setSelectedRaffleId(selectedRaffleToJoin);
                  setSelectedRaffleToJoin(null);
                } else {
                  setShowJoinRaffle(true);
                  setShowCreateRaffle(false);
                }
              }}
              disabled={!selectedRaffleToJoin}
              className="flex-1 px-6 py-4 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Unirse a Rifa
            </button>
          </div>

          {/* Create Raffle Form */}
          {showCreateRaffle && (
            <div className="w-full bg-white dark:bg-zinc-900 rounded-lg p-6 border border-zinc-300 dark:border-zinc-700 mb-8">
              <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
                Crear Nueva Rifa
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                    Cantidad de Números
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="Ej: 1000"
                    value={raffleAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d+$/.test(val)) setRaffleAmount(val);
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                    Precio por Número
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Ej: 100.50"
                    value={rafflePrice}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '' || /^\d*\.?\d*$/.test(val)) setRafflePrice(val);
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                    Buscar y Asignar Vendedores
                  </label>
                  <input
                    type="text"
                    placeholder="Buscar vendedor..."
                    value={sellerSearchTerm}
                    onChange={(e) => setSellerSearchTerm(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 mb-2"
                  />
                  {sellerSearchTerm && searchSellers && searchSellers.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {searchSellers
                        ?.filter((s: { _id: Id<'sellers'>; name: string }) => !selectedSellers.find((sel) => sel.id === s._id))
                        .map((seller: { _id: Id<'sellers'>; name: string }) => (
                          <button
                            key={seller._id}
                            onClick={() => handleAddSeller(seller)}
                            className="w-full text-left px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-black dark:text-zinc-50"
                          >
                            {seller.name}
                          </button>
                        ))}
                    </div>
                  )}
                  {selectedSellers.length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-black dark:text-zinc-50">
                        Vendedores asignados:
                      </p>
                      {selectedSellers.map((seller) => (
                        <div
                          key={seller.id}
                          className="flex items-center justify-between px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700"
                        >
                          <span className="text-black dark:text-zinc-50">{seller.name}</span>
                          <div className="flex gap-2">
                            <select
                              value={seller.role}
                              onChange={(e) =>
                                handleChangeSellerRole(
                                  seller.id,
                                  e.target.value as 'owner' | 'moderator' | 'seller'
                                )
                              }
                              className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 text-sm"
                            >
                              <option value="seller">Vendedor</option>
                              <option value="moderator">Moderador</option>
                              <option value="owner">Dueño</option>
                            </select>
                            <button
                              onClick={() => handleRemoveSeller(seller.id)}
                              className="px-2 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700"
                            >
                              Eliminar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCreateRaffle}
                    className="flex-1 px-4 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
                  >
                    Crear Rifa
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateRaffle(false);
                      setRaffleAmount('');
                      setRafflePrice('');
                      setSelectedSellers([]);
                    }}
                    className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Join Raffle Instructions */}
          {showJoinRaffle && (
            <div className="w-full">
              <p className="text-zinc-600 dark:text-zinc-400 text-center py-4">
                Selecciona una rifa de la lista de arriba para unirte
              </p>
            </div>
          )}
        </main>
      </div>
    );
  }

  // Main Screen - Raffle selected
  const canEndRaffle = sellerRole === 'owner' || sellerRole === 'moderator';

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center px-4 py-8">
        {/* Header with Raffle Selector */}
        <div className="w-full mb-6">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
              {seller?.name}
            </h1>
            <button
              onClick={() => {
                localStorage.removeItem('sellerId');
                setSellerId(null);
                setShowAuth(true);
                setChatOpen(false);
              }}
              className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
            >
              Cerrar Sesión
            </button>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={selectedRaffleId}
              onChange={(e) => {
                setSelectedRaffleId(e.target.value as Id<'raffles'>);
                setChatOpen(false);
                setRevenue(null);
              }}
              className="flex-1 px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50"
            >
              {raffles?.map((r) => (
                <option key={r._id} value={r._id}>
                  Rifa - {r.amountOfNumbers} números ({r.state})
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              {(sellerRole === 'owner' || sellerRole === 'moderator') && (
                <button
                  onClick={() => setShowManageSellers(true)}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-colors"
                >
                  Gestionar Vendedores
                </button>
              )}
              <button
                onClick={handleCalculateRevenue}
                className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
              >
                Calcular Ingresos
              </button>
            </div>
          </div>
          {selectedRaffle && (
            <div className="mt-2 space-y-1">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                Estado: {selectedRaffle.state} | Precio: ${selectedRaffle.price} | Rol: {sellerRole}
              </div>
              {revenue !== null && (
                <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                  Ingresos calculados: ${revenue.toFixed(2)} ({allRaffleNumbers?.length || 0} números × ${selectedRaffle.price.toFixed(2)})
                </div>
              )}
            </div>
          )}
        </div>

        {/* Registration Form */}
        <div className="w-full flex flex-col gap-4 mb-8">
          <input
            type="text"
            inputMode="numeric"
            placeholder="Número"
            value={numero}
            onChange={handleNumberChange}
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
          <input
            type="text"
            placeholder="Nombre del comprador"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
          <input
            type="text"
            placeholder="Email o Teléfono"
            value={contacto}
            onChange={(e) => setContacto(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
          />
          <div className="flex gap-4">
            <button
              onClick={handleRegisterNumber}
              disabled={selectedRaffle?.state === 'complete'}
              className="flex-1 px-4 py-3 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-black font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Registrar
            </button>
            {canEndRaffle && selectedRaffle?.state !== 'complete' && (
              <button
                onClick={handleEndRaffle}
                className="px-4 py-3 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
              >
                Finalizar Rifa
              </button>
            )}
          </div>
        </div>

        {/* Numbers List with Pagination */}
        <div className="w-full">
          <h2 className="text-xl font-semibold mb-4 text-black dark:text-zinc-50">
            Números Registrados
          </h2>

          {/* Search Input - on top of registered numbers */}
          <div className="w-full mb-4">
            <input
              type="text"
              placeholder="Buscar por número, nombre o contacto..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-zinc-500 dark:focus:ring-zinc-400"
            />
          </div>

          {!searchResults ? (
            <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">
              Cargando...
            </p>
          ) : searchResults.results.length === 0 ? (
            <p className="text-zinc-600 dark:text-zinc-400 text-center py-8">
              {busquedaDebounced ? 'No se encontraron resultados' : 'Aún no hay números registrados'}
            </p>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {searchResults.results.map((num: any) => (
                  <div
                    key={num._id}
                    className="px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  >
                    <div className="text-black dark:text-zinc-50">
                      <p className="font-medium">Número: {num.number}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Comprador: {num.buyerName}
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        Contacto: {num.buyerContact}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              {/* Pagination */}
              <div className="flex justify-between items-center">
                <button
                  onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                  disabled={currentPage === 0}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  Página {currentPage + 1}
                </span>
                <button
                  onClick={() => setCurrentPage(currentPage + 1)}
                  disabled={searchResults.isDone}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </div>

        {/* Manage Sellers Modal */}
        {showManageSellers && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-zinc-900 rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col m-4">
              {/* Modal Header */}
              <div className="flex justify-between items-center p-6 border-b border-zinc-300 dark:border-zinc-700">
                <h2 className="text-2xl font-semibold text-black dark:text-zinc-50">
                  Gestionar Vendedores
                </h2>
                <button
                  onClick={() => {
                    setShowManageSellers(false);
                    setSellerSearchManage('');
                    setSelectedSellerToAdd(null);
                  }}
                  className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50 text-2xl"
                >
                  ✕
                </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Add Seller Section */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
                    Agregar Vendedor
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                        Buscar Vendedor
                      </label>
                      <input
                        type="text"
                        placeholder="Buscar por nombre de usuario..."
                        value={sellerSearchManage}
                        onChange={(e) => {
                          setSellerSearchManage(e.target.value);
                          setSelectedSellerToAdd(null);
                        }}
                        className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                      {sellerSearchManage && searchSellersForManage && searchSellersForManage.length > 0 && (
                        <div className="mt-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 max-h-48 overflow-y-auto">
                          {searchSellersForManage
                            .filter((s: { _id: Id<'sellers'>; name: string }) => {
                              // Excluir vendedores que ya están en la rifa
                              return !raffleSellers?.some((rs: any) => rs._id === s._id);
                            })
                            .map((seller: { _id: Id<'sellers'>; name: string }) => (
                              <button
                                key={seller._id}
                                onClick={() => {
                                  setSelectedSellerToAdd(seller._id);
                                  setSellerSearchManage(seller.name);
                                }}
                                className={`w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${selectedSellerToAdd === seller._id
                                  ? 'bg-purple-100 dark:bg-purple-900/20'
                                  : ''
                                  }`}
                              >
                                <p className="text-black dark:text-zinc-50">{seller.name}</p>
                              </button>
                            ))}
                        </div>
                      )}
                    </div>
                    {selectedSellerToAdd && (
                      <div>
                        <label className="block text-sm font-medium mb-2 text-black dark:text-zinc-50">
                          Rol
                        </label>
                        <select
                          value={newSellerRole}
                          onChange={(e) =>
                            setNewSellerRole(e.target.value as 'owner' | 'moderator' | 'seller')
                          }
                          className="w-full px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                          <option value="seller">Vendedor</option>
                          <option value="moderator">Moderador</option>
                          <option value="owner">Dueño</option>
                        </select>
                      </div>
                    )}
                    <button
                      onClick={handleAddSellerToRaffle}
                      disabled={!selectedSellerToAdd}
                      className="w-full px-4 py-3 rounded-lg bg-purple-600 text-white font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Agregar Vendedor
                    </button>
                  </div>
                </div>

                {/* Current Sellers List */}
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-black dark:text-zinc-50">
                    Vendedores Actuales
                  </h3>
                  {!raffleSellers ? (
                    <p className="text-zinc-600 dark:text-zinc-400 text-center py-4">
                      Cargando...
                    </p>
                  ) : raffleSellers.length === 0 ? (
                    <p className="text-zinc-600 dark:text-zinc-400 text-center py-4">
                      No hay vendedores asignados
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {raffleSellers.map((rs: any) => (
                        <div
                          key={rs._id}
                          className="flex justify-between items-center px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        >
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-black dark:text-zinc-50">
                                {rs.name}
                              </p>
                              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                Rol: {rs.role}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs px-2 py-1 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                              {rs.role}
                            </span>
                            {rs._id !== sellerId && (
                              <button
                                onClick={() => handleRemoveSellerFromRaffle(rs._id)}
                                className="px-3 py-1 rounded bg-red-600 text-white text-sm hover:bg-red-700 transition-colors"
                              >
                                Eliminar
                              </button>
                            )}
                            {rs._id === sellerId && (
                              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                Tú
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 border-t border-zinc-300 dark:border-zinc-700">
                <button
                  onClick={() => {
                    setShowManageSellers(false);
                    setSellerSearchManage('');
                    setSelectedSellerToAdd(null);
                  }}
                  className="w-full px-4 py-3 rounded-lg bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50 font-medium hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chat Component - Fixed at bottom right */}
        {selectedRaffleId && sellerId && (
          <div className="fixed bottom-4 right-4 z-50">
            {chatOpen ? (
              <div className="w-80 h-96 bg-white dark:bg-zinc-900 rounded-lg shadow-2xl border border-zinc-300 dark:border-zinc-700 flex flex-col">
                {/* Chat Header */}
                <div className="flex justify-between items-center p-4 border-b border-zinc-300 dark:border-zinc-700">
                  <h3 className="font-semibold text-black dark:text-zinc-50">
                    Chat de Vendedores
                  </h3>
                  <button
                    onClick={() => setChatOpen(false)}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-black dark:hover:text-zinc-50"
                  >
                    ✕
                  </button>
                </div>

                {/* Chat Messages */}
                <div
                  id="chat-messages"
                  className="flex-1 overflow-y-auto p-4 space-y-3"
                >
                  {!chatMessages ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                      Cargando mensajes...
                    </p>
                  ) : chatMessages.length === 0 ? (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 text-center">
                      No hay mensajes aún
                    </p>
                  ) : (
                    chatMessages.map((msg: any) => {
                      const isOwnMessage = msg.sellerId === sellerId;
                      return (
                        <div
                          key={msg._id}
                          className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'
                            }`}
                        >
                          <div
                            className={`max-w-[80%] rounded-lg px-3 py-2 ${isOwnMessage
                              ? 'bg-blue-600 text-white'
                              : 'bg-zinc-200 dark:bg-zinc-800 text-black dark:text-zinc-50'
                              }`}
                          >
                            {!isOwnMessage && (
                              <p className="text-xs font-semibold mb-1 opacity-75">
                                {msg.sellerName}
                              </p>
                            )}
                            <p className="text-sm">{msg.message}</p>
                            <p className="text-xs mt-1 opacity-75">
                              {new Date(msg.createdAt).toLocaleTimeString('es-ES', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Chat Input */}
                <div className="p-4 border-t border-zinc-300 dark:border-zinc-700">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Escribe un mensaje..."
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendChatMessage();
                        }
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                    <button
                      onClick={handleSendChatMessage}
                      disabled={!chatMessage.trim()}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Enviar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setChatOpen(true)}
                className="relative w-14 h-14 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                title="Abrir chat"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {chatMessages && chatMessages.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {chatMessages.length}
                  </span>
                )}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
