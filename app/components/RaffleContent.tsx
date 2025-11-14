'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

interface RaffleContentProps {
  raffleId: Id<'raffles'>;
  sellerId: Id<'sellers'>;
}

export default function RaffleContent({ raffleId, sellerId }: RaffleContentProps) {
  const router = useRouter();

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
  const seller = useQuery(api.auth.getSeller, { sellerId });
  const raffles = useQuery(api.raffles.getRafflesBySeller, { sellerId });
  const selectedRaffle = useQuery(api.raffles.getRaffle, { raffleId });
  const sellerRole = useQuery(api.raffles.getSellerRole, { sellerId, raffleId });
  const searchResults = useQuery(
    api.numbers.searchNumbers,
    {
      raffleId,
      searchTerm: busquedaDebounced || undefined,
      paginationOpts: {
        numItems: itemsPerPage,
        cursor: (currentPage * itemsPerPage).toString(),
      },
    }
  );
  const allRaffleNumbers = useQuery(api.numbers.getNumbersByRaffle, { raffleId });
  const chatMessages = useQuery(api.chat.getMessages, { raffleId, sellerId });
  const raffleSellers = useQuery(api.raffles.getSellersByRaffle, { raffleId });
  const searchSellersForManage = useQuery(
    api.raffles.searchSellers,
    { searchTerm: sellerSearchManage }
  );

  // Convex mutations
  const registerNumber = useMutation(api.numbers.registerNumber);
  const updateRaffleState = useMutation(api.raffles.updateRaffleState);
  const assignSellerToRaffle = useMutation(api.raffles.assignSellerToRaffle);
  const removeSellerFromRaffle = useMutation(api.raffles.removeSellerFromRaffle);
  const sendChatMessage = useMutation(api.chat.sendMessage);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setBusquedaDebounced(busqueda);
      setCurrentPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Handle number input (numbers only)
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '' || /^\d+$/.test(value)) {
      setNumero(value);
    }
  };

  // Handle register number
  const handleRegisterNumber = async () => {
    if (!numero.trim() || !nombre.trim() || !contacto.trim()) {
      alert('Completa todos los campos');
      return;
    }

    try {
      await registerNumber({
        number: numero.trim(),
        raffleId,
        sellerId,
        buyerName: nombre.trim(),
        buyerContact: contacto.trim(),
      });
      setNumero('');
      setNombre('');
      setContacto('');
      setCurrentPage(0);
    } catch (error) {
      alert('Error al registrar número: ' + (error as Error).message);
    }
  };

  // Handle end raffle
  const handleEndRaffle = async () => {
    if (!confirm('¿Estás seguro de que deseas finalizar esta rifa?')) return;

    try {
      await updateRaffleState({
        raffleId,
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
    if (!chatMessage.trim()) return;

    try {
      await sendChatMessage({
        raffleId,
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
    if (!selectedSellerToAdd) return;

    try {
      await assignSellerToRaffle({
        sellerId: selectedSellerToAdd,
        raffleId,
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
    if (!confirm('¿Estás seguro de que deseas eliminar este vendedor de la rifa?')) return;

    try {
      await removeSellerFromRaffle({
        sellerId: sellerIdToRemove,
        raffleId,
        requesterId: sellerId,
      });
    } catch (error) {
      alert('Error al eliminar vendedor: ' + (error as Error).message);
    }
  };

  // Handle change seller role
  const handleChangeSellerRole = async (sellerIdToChange: Id<'sellers'>, newRole: 'owner' | 'moderator' | 'seller') => {
    try {
      await assignSellerToRaffle({
        sellerId: sellerIdToChange,
        raffleId,
        role: newRole,
        requesterId: sellerId,
      });
    } catch (error) {
      alert('Error al cambiar rol: ' + (error as Error).message);
    }
  };

  // Handle calculate revenue
  const handleCalculateRevenue = () => {
    if (!selectedRaffle || !allRaffleNumbers) return;

    const numberOfNumbers = allRaffleNumbers.length;
    const totalRevenue = numberOfNumbers * selectedRaffle.price;
    setRevenue(totalRevenue);
  };

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
            <div className="flex gap-2">
              <button
                onClick={() => router.push('/')}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
              >
                Seleccionar Otra Rifa
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('sellerId');
                  router.push('/');
                }}
                className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-black dark:text-zinc-50 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={raffleId}
              onChange={(e) => {
                router.push(`/raffle/${e.target.value}`);
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
                              return !raffleSellers?.some((rs: any) => rs._id === s._id);
                            })
                            .map((seller: { _id: Id<'sellers'>; name: string }) => (
                              <button
                                key={seller._id}
                                onClick={() => {
                                  setSelectedSellerToAdd(seller._id);
                                  setSellerSearchManage(seller.name);
                                }}
                                className={`w-full text-left px-4 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                                  selectedSellerToAdd === seller._id
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
                            <select
                              value={rs.role}
                              onChange={(e) => handleChangeSellerRole(rs._id, e.target.value as 'owner' | 'moderator' | 'seller')}
                              className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-black dark:text-zinc-50 focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                              <option value="seller">Vendedor</option>
                              <option value="moderator">Moderador</option>
                              <option value="owner">Dueño</option>
                            </select>
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
                        className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-lg px-3 py-2 ${
                            isOwnMessage
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
      </main>
    </div>
  );
}
