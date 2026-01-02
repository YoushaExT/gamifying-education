import { useQuery } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import type { UserPublic } from "@/client"
import { UsersService } from "@/client"

export interface CardInstance {
  card_key: string
  name: string
  description?: string
  card_type: string
  effect_data: {
    min_value?: number
    max_value?: number
  }
  question_id?: string
}

export interface PlayerState {
  id: string
  name: string
  health: number
  shield: number
  hand_count: number
  is_current_turn: boolean
  ability_cooldown: number
  ability_active: boolean
}

export interface CardGameState {
  game_id: string
  status: "waiting" | "in_progress" | "finished"
  host: PlayerState | null
  guest: PlayerState | null
  deck_count: number
  turn_number: number
  fatigue_damage: number
  current_turn: string
  winner: string | null
  end_reason?: string | null
  // Lobby-specific fields
  host_id?: string | null
  guest_id?: string | null
  host_name?: string | null
  guest_name?: string | null
  host_ready?: boolean
  guest_ready?: boolean
}

export interface CardResolvedData {
  player: string
  card: {
    card_key: string
    name: string
    card_type: string
  }
  is_correct: boolean
  effect_value: number
  state: CardGameState
}

export interface TurnEndData {
  fatigue_damage: number
  next_player: string
  state: CardGameState
}

export interface AbilityCardResolvedData {
  player: string
  card: {
    card_key: string
    name: string
    card_type: string
  }
  is_first_correct: boolean
  is_second_correct: boolean
  effect_value: number
  is_reversed: boolean
  state: CardGameState
}

type CardGameMessageType =
  | "connected"
  | "player_joined"
  | "player_ready"
  | "game_start"
  | "your_hand"
  | "turn_start"
  | "timer_update"
  | "card_resolved"
  | "turn_end"
  | "turn_skipped"
  | "game_over"
  | "player_disconnected"
  | "ability_activated"
  | "card_resolved_with_ability"
  | "error"

interface CardGameWebSocketMessage {
  type: CardGameMessageType
  [key: string]: unknown
}

interface UseCardGameWebSocketOptions {
  gameId: string
  onGameStart?: (state: CardGameState) => void
  onTurnStart?: (hand: CardInstance[], state: CardGameState) => void
  onCardResolved?: (data: CardResolvedData) => void
  onTurnEnd?: (data: TurnEndData) => void
  onTurnSkipped?: (data: TurnEndData) => void
  onGameOver?: (winner: string, state: CardGameState) => void
  onAbilityActivated?: (player: string, state: CardGameState) => void
  onCardResolvedWithAbility?: (data: AbilityCardResolvedData) => void
}

export function useGameWebSocket({
  gameId,
  onGameStart,
  onTurnStart,
  onCardResolved,
  onTurnEnd,
  onTurnSkipped,
  onGameOver,
  onAbilityActivated,
  onCardResolvedWithAbility,
}: UseCardGameWebSocketOptions) {
  const { data: currentUser } = useQuery<UserPublic | null, Error>({
    queryKey: ["currentUser"],
    queryFn: UsersService.readUserMe,
    staleTime: Infinity,
  })

  const [isConnected, setIsConnected] = useState(false)
  const [gameState, setGameState] = useState<CardGameState | null>(null)
  const [myPlayer, setMyPlayer] = useState<"host" | "guest" | null>(null)
  const [myHand, setMyHand] = useState<CardInstance[]>([])
  const [timerSeconds, setTimerSeconds] = useState<number>(30)
  const [error, setError] = useState<string | null>(null)
  const [lastCardResult, setLastCardResult] = useState<CardResolvedData | null>(
    null,
  )
  const [lastOpponentInfo, setLastOpponentInfo] = useState<{
    name: string
    health: number
    shield: number
  } | null>(null)

  // Ref to track current hand for use in callbacks
  const myHandRef = useRef<CardInstance[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Store callbacks in refs to avoid dependency issues
  const onGameStartRef = useRef(onGameStart)
  const onTurnStartRef = useRef(onTurnStart)
  const onCardResolvedRef = useRef(onCardResolved)
  const onTurnEndRef = useRef(onTurnEnd)
  const onTurnSkippedRef = useRef(onTurnSkipped)
  const onGameOverRef = useRef(onGameOver)
  const onAbilityActivatedRef = useRef(onAbilityActivated)
  const onCardResolvedWithAbilityRef = useRef(onCardResolvedWithAbility)

  useEffect(() => {
    onGameStartRef.current = onGameStart
    onTurnStartRef.current = onTurnStart
    onCardResolvedRef.current = onCardResolved
    onTurnEndRef.current = onTurnEnd
    onTurnSkippedRef.current = onTurnSkipped
    onGameOverRef.current = onGameOver
    onAbilityActivatedRef.current = onAbilityActivated
    onCardResolvedWithAbilityRef.current = onCardResolvedWithAbility
  }, [
    onGameStart,
    onTurnStart,
    onCardResolved,
    onTurnEnd,
    onTurnSkipped,
    onGameOver,
    onAbilityActivated,
    onCardResolvedWithAbility,
  ])

  const handleMessage = useCallback(
    (message: CardGameWebSocketMessage) => {
      // Defer state updates to avoid "Cannot update component while rendering" errors
      queueMicrotask(() => {
        switch (message.type) {
          case "connected": {
            setIsConnected(true)
            const player = message.player as "host" | "guest"
            setMyPlayer(player)
            if (message.game_state) {
              const newState = message.game_state as CardGameState
              setGameState(newState)
            }
            if (message.hand) {
              const hand = message.hand as CardInstance[]
              myHandRef.current = hand
              setMyHand(hand)
            }
            break
          }

          case "player_joined": {
            if (message.player_name) {
              setGameState((prev) => {
                if (!prev) return null

                const playerRole = message.player_role as
                  | "host"
                  | "guest"
                  | undefined
                const playerState = message.player_state as
                  | PlayerState
                  | undefined

                // Handle host reconnection during active game
                if (
                  playerRole === "host" &&
                  prev.host === null &&
                  prev.status === "in_progress" &&
                  playerState
                ) {
                  return {
                    ...prev,
                    host: playerState,
                    host_id: message.user_id as string,
                    host_name: message.player_name as string,
                  }
                }

                // Handle guest reconnection during active game
                if (
                  playerRole === "guest" &&
                  prev.guest === null &&
                  prev.status === "in_progress" &&
                  playerState
                ) {
                  return {
                    ...prev,
                    guest: playerState,
                    guest_id: message.user_id as string,
                    guest_name: message.player_name as string,
                  }
                }

                // Normal join during lobby (not a reconnection)
                // Only update IDs/names, not PlayerState (will be set when game starts)
                if (playerRole === "host") {
                  return {
                    ...prev,
                    host_id: message.user_id as string,
                    host_name: message.player_name as string,
                  }
                }
                return {
                  ...prev,
                  guest_id: message.user_id as string,
                  guest_name: message.player_name as string,
                }
              })
            }
            break
          }

          case "player_ready": {
            setGameState((prev) => {
              if (!prev) return null
              return {
                ...prev,
                host_ready: message.host_ready as boolean,
                guest_ready: message.guest_ready as boolean,
              }
            })
            break
          }

          case "game_start": {
            const state = message.state as CardGameState
            setGameState(state)
            setTimerSeconds(30)
            if (onGameStartRef.current) {
              onGameStartRef.current(state)
            }
            break
          }

          case "your_hand": {
            const hand = message.hand as CardInstance[]
            console.log("Received your_hand event:", hand)
            myHandRef.current = hand
            setMyHand(hand)
            break
          }

          case "turn_start": {
            const state = message.state as CardGameState
            setGameState(state)
            setTimerSeconds((message.timer_seconds as number) || 30)
            if (onTurnStartRef.current) {
              // Pass current hand from ref since it was set via your_hand event
              onTurnStartRef.current(myHandRef.current, state)
            }
            break
          }

          case "timer_update": {
            setTimerSeconds(message.seconds_remaining as number)
            break
          }

          case "card_resolved": {
            const data: CardResolvedData = {
              player: message.player as string,
              card: message.card as CardResolvedData["card"],
              is_correct: message.is_correct as boolean,
              effect_value: message.effect_value as number,
              state: message.state as CardGameState,
            }
            setLastCardResult(data)
            setGameState(data.state)
            if (onCardResolvedRef.current) {
              onCardResolvedRef.current(data)
            }
            break
          }

          case "turn_end": {
            const data: TurnEndData = {
              fatigue_damage: message.fatigue_damage as number,
              next_player: message.next_player as string,
              state: message.state as CardGameState,
            }
            setGameState(data.state)
            setTimerSeconds(30)
            if (onTurnEndRef.current) {
              onTurnEndRef.current(data)
            }
            break
          }

          case "turn_skipped": {
            const data: TurnEndData = {
              fatigue_damage: message.fatigue_damage as number,
              next_player: message.next_player as string,
              state: message.state as CardGameState,
            }
            setGameState(data.state)
            setTimerSeconds(30)
            if (onTurnSkippedRef.current) {
              onTurnSkippedRef.current(data)
            }
            break
          }

          case "game_over": {
            const winner = message.winner as string
            const state = message.state as CardGameState
            setGameState(state)
            if (onGameOverRef.current) {
              onGameOverRef.current(winner, state)
            }
            break
          }

          case "player_disconnected": {
            // Clear disconnected player from game state
            setGameState((prev) => {
              if (!prev) return null

              // If guest disconnects, clear them from game state
              if (message.user_id === prev.guest_id) {
                return {
                  ...prev,
                  guest: null,
                  guest_id: null,
                  guest_name: null,
                  guest_ready: false,
                }
              }

              // If host disconnects (shouldn't happen often but handle it)
              if (message.user_id === prev.host_id) {
                return {
                  ...prev,
                  host: null,
                  host_id: null,
                  host_name: null,
                  host_ready: false,
                }
              }

              return prev
            })
            break
          }

          case "ability_activated": {
            const state = message.state as CardGameState
            setGameState(state)
            if (onAbilityActivatedRef.current) {
              onAbilityActivatedRef.current(message.player as string, state)
            }
            break
          }

          case "card_resolved_with_ability": {
            const data: AbilityCardResolvedData = {
              player: message.player as string,
              card: message.card as AbilityCardResolvedData["card"],
              is_first_correct: message.is_first_correct as boolean,
              is_second_correct: message.is_second_correct as boolean,
              effect_value: message.effect_value as number,
              is_reversed: message.is_reversed as boolean,
              state: message.state as CardGameState,
            }
            setGameState(data.state)
            if (onCardResolvedWithAbilityRef.current) {
              onCardResolvedWithAbilityRef.current(data)
            }
            break
          }

          case "error": {
            setError((message.message as string) || "An error occurred")
            break
          }

          default:
            console.warn("Unknown message type:", message.type)
        }
      })
    },
    [], // No dependencies - all callbacks accessed via refs
  )

  const connect = useCallback(() => {
    if (!currentUser) {
      console.warn("Cannot connect WebSocket: no current user")
      return
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected")
      return
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:"
    const backendHost =
      import.meta.env.VITE_API_URL?.replace(/^https?:\/\//, "") ||
      window.location.host
    const wsUrl = `${protocol}//${backendHost}/api/v1/multiplayer/games/${gameId}/ws`

    console.log("Connecting to WebSocket:", wsUrl)
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      console.log("WebSocket connected successfully")
      setIsConnected(true)
      ws.send(JSON.stringify({ user_id: currentUser.id }))
      console.log("Sent user_id:", currentUser.id)
    }

    ws.onmessage = (event) => {
      try {
        const message: CardGameWebSocketMessage = JSON.parse(event.data)
        handleMessage(message)
      } catch (err) {
        console.error("Failed to parse WebSocket message:", err)
      }
    }

    ws.onerror = (error) => {
      console.error("WebSocket error:", error)
      setError("Connection error")
    }

    ws.onclose = (event) => {
      console.log("WebSocket disconnected", {
        code: event.code,
        reason: event.reason,
        wasClean: event.wasClean,
      })
      setIsConnected(false)

      // Only reconnect if it wasn't a clean/intentional close
      const shouldNotReconnect = [1000, 1001, 1005].includes(event.code)

      if (!shouldNotReconnect) {
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect...")
          connect()
        }, 3000)
      } else {
        console.log("Clean disconnect, not reconnecting")
      }
    }
  }, [currentUser, gameId, handleMessage])

  const sendReady = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "player_ready" }))
    }
  }

  const playCard = (cardIndex: number, selectedAnswers: number[]) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "play_card",
          card_index: cardIndex,
          selected_answers: selectedAnswers,
        }),
      )
    }
  }

  const playCardWithAbility = (
    cardIndex: number,
    selectedAnswers1: number[],
    selectedAnswers2: number[],
  ) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "play_card",
          card_index: cardIndex,
          is_ability_card: true,
          selected_answers1: selectedAnswers1,
          selected_answers2: selectedAnswers2,
        }),
      )
    }
  }

  const skipTurn = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "skip_turn" }))
    }
  }

  const activateAbility = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "activate_ability" }))
    }
  }

  const forfeitGame = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "forfeit_game" }))
    }
  }

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    if (
      currentUser &&
      (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)
    ) {
      connect()
    }

    return () => {
      disconnect()
    }
  }, [connect, disconnect, currentUser])

  const isMyTurn = gameState?.current_turn === myPlayer
  const myPlayerState = myPlayer === "host" ? gameState?.host : gameState?.guest
  const opponentState = myPlayer === "host" ? gameState?.guest : gameState?.host

  // Preserve opponent's last known state when they're connected
  useEffect(() => {
    if (opponentState) {
      setLastOpponentInfo({
        name: opponentState.name,
        health: opponentState.health,
        shield: opponentState.shield,
      })
    }
  }, [opponentState])

  return {
    // Connection state
    isConnected,
    error,

    // Game state
    gameState,
    myPlayer,
    myHand,
    timerSeconds,
    lastCardResult,

    // Computed
    isMyTurn,
    myPlayerState,
    opponentState,
    lastOpponentInfo,

    // Actions
    sendReady,
    playCard,
    playCardWithAbility,
    skipTurn,
    activateAbility,
    forfeitGame,
    disconnect,
  }
}
