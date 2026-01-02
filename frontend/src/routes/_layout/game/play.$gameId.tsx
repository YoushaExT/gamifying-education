import { OrbitControls, Text } from "@react-three/drei"
import { Canvas } from "@react-three/fiber"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import {
  Clock,
  Heart,
  Loader2,
  Shield,
  SkipForward,
  Swords,
  XCircle,
  Zap,
} from "lucide-react"
import { useCallback, useState } from "react"
import { toast } from "sonner"

import { MultiplayerGameService, QuestionsService } from "@/client"
import { OutlinedText } from "@/components/Game"
import { QuestionPopup } from "@/components/MultiplayerGame/QuestionPopup"
import { Button } from "@/components/ui/button"
import { COLORS, GAME_FONT } from "@/constants"
import { useConfirm } from "@/hooks/useConfirm"
import {
  type AbilityCardResolvedData,
  type CardGameState,
  type CardInstance,
  type CardResolvedData,
  useGameWebSocket,
} from "@/hooks/useGameWebSocket"
import { cn } from "@/lib/utils"
import { Card3D } from "@/models/Card3D"
import { HealthBar3D } from "@/models/HealthBar3D"

export const Route = createFileRoute("/_layout/game/play/$gameId")({
  component: GamePlayPage,
})

interface QuestionData {
  id: string
  question_text: string
  choices: string[]
  question_type: string
}

function GamePlayPage() {
  const { gameId } = Route.useParams()
  const navigate = useNavigate()
  const { confirm } = useConfirm()
  const queryClient = useQueryClient()

  // UI state
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(
    null,
  )
  const [showQuestion, setShowQuestion] = useState(false)
  const [_currentQuestion, _setCurrentQuestion] = useState<QuestionData | null>(
    null,
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [lastResult, setLastResult] = useState<CardResolvedData | null>(null)
  const [showResultAnimation, setShowResultAnimation] = useState(false)

  // Double question flow state (for ability)
  const [secondQuestion, setSecondQuestion] = useState<QuestionData | null>(
    null,
  )
  const [showSecondQuestion, setShowSecondQuestion] = useState(false)
  const [firstQuestionAnswers, setFirstQuestionAnswers] = useState<number[]>([])
  const [isLoadingSecondQuestion, setIsLoadingSecondQuestion] = useState(false)

  // Game callbacks
  const handleGameStart = useCallback((state: CardGameState) => {
    toast.success("Game started!")
    console.log("Game started with state:", state)
  }, [])

  const handleTurnStart = useCallback(
    (hand: CardInstance[], state: CardGameState) => {
      console.log("Turn started. Hand:", hand, "State:", state)
    },
    [],
  )

  const handleCardResolved = useCallback((data: CardResolvedData) => {
    setLastResult(data)
    setShowResultAnimation(true)
    setShowQuestion(false)
    setSelectedCardIndex(null)
    setIsSubmitting(false)

    const resultMsg = data.is_correct
      ? `Correct! ${data.card.name} deals ${data.effect_value} ${data.card.card_type.replace("basic_", "")}!`
      : `Wrong answer. ${data.card.name} deals only ${data.effect_value} ${data.card.card_type.replace("basic_", "")}.`
    toast.info(resultMsg)

    // Hide result animation after a delay
    setTimeout(() => setShowResultAnimation(false), 2000)
  }, [])

  const handleGameOver = useCallback(
    (_winner: string, _state: CardGameState) => {
      // Invalidate active game query so it refreshes immediately
      queryClient.invalidateQueries({ queryKey: ["activeGame"] })

      // Navigate to results page - detailed results shown there
      toast.success("Game Over!")
      navigate({ to: `/game/results/${gameId}` })
    },
    [gameId, navigate, queryClient],
  )

  // WebSocket connection
  const {
    isConnected,
    gameState,
    myPlayer,
    myHand,
    timerSeconds,
    isMyTurn,
    myPlayerState,
    opponentState,
    lastOpponentInfo,
    playCard,
    playCardWithAbility,
    skipTurn,
    activateAbility,
    forfeitGame,
    error,
  } = useGameWebSocket({
    gameId,
    onGameStart: handleGameStart,
    onTurnStart: handleTurnStart,
    onCardResolved: handleCardResolved,
    onGameOver: handleGameOver,
    onAbilityActivated: (player: string, _state: CardGameState) => {
      if (player === myPlayer) {
        toast.success("Special ability activated!")
      } else {
        toast.info("Opponent activated their ability!")
      }
    },
    onCardResolvedWithAbility: (data: AbilityCardResolvedData) => {
      setShowQuestion(false)
      setShowSecondQuestion(false)
      setSelectedCardIndex(null)
      setIsSubmitting(false)
      setFirstQuestionAnswers([])

      let resultMsg = ""
      if (data.is_reversed) {
        resultMsg = `❌ Wrong! ${data.card.name} REVERSED - effect applied to YOU!`
      } else if (data.is_first_correct && data.is_second_correct) {
        resultMsg = `🎉 DOUBLE CORRECT! ${data.card.name} deals ${data.effect_value} ${data.card.card_type.replace("basic_", "")}!`
      }

      toast.info(resultMsg, { duration: 4000 })
    },
  })

  // Query for question when card is selected
  const { data: questionData, isLoading: isLoadingQuestion } = useQuery({
    queryKey: ["question", myHand[selectedCardIndex ?? -1]?.question_id],
    queryFn: async () => {
      const questionId = myHand[selectedCardIndex ?? -1]?.question_id
      if (!questionId) return null

      // Get question from API
      const response = await QuestionsService.readQuestion({ id: questionId })
      return response as QuestionData
    },
    enabled:
      selectedCardIndex !== null &&
      myHand[selectedCardIndex]?.question_id !== undefined,
  })

  // Handle card click
  const handleCardClick = (index: number) => {
    if (!isMyTurn || gameState?.status !== "in_progress") return

    setSelectedCardIndex(index)
    setShowQuestion(true)
  }

  // Handle question submit
  const handleQuestionSubmit = async (selectedAnswers: number[]) => {
    if (selectedCardIndex === null) return

    const myAbilityActive =
      myPlayer === "host"
        ? (gameState?.host?.ability_active ?? false)
        : (gameState?.guest?.ability_active ?? false)

    if (myAbilityActive) {
      // ABILITY ACTIVE FLOW - Double questions
      if (!showSecondQuestion) {
        // First question submitted - save answer and fetch second question
        setFirstQuestionAnswers(selectedAnswers)
        setShowQuestion(false)
        setIsLoadingSecondQuestion(true)

        try {
          // Fetch second random question from game's question pool
          const question2 =
            await MultiplayerGameService.getRandomQuestionForGame({
              gameId,
            })

          setSecondQuestion({
            id: question2.id ?? "",
            question_text: question2.question_text,
            choices: question2.choices,
            question_type: question2.question_type ?? "mcq",
          })
          setShowSecondQuestion(true)
        } catch (error) {
          console.error("Failed to load second question:", error)
          toast.error("Failed to load second question")
          // Reset state
          setSelectedCardIndex(null)
          setFirstQuestionAnswers([])
        } finally {
          setIsLoadingSecondQuestion(false)
        }
      } else {
        // Second question submitted - send both answers to backend
        setIsSubmitting(true)

        // Send both answers via WebSocket with ability card flag
        // Backend will handle this through handle_play_card_with_ability
        playCardWithAbility(
          selectedCardIndex,
          firstQuestionAnswers,
          selectedAnswers,
        )

        // Clear state (will be reset by handleCardResolvedWithAbility callback)
        // setShowSecondQuestion(false)
        // setSecondQuestion(null)
        // setFirstQuestionAnswers([])
      }
    } else {
      // NORMAL FLOW - Single question
      setIsSubmitting(true)
      playCard(selectedCardIndex, selectedAnswers)
    }
  }

  // Handle skip turn
  const handleSkipTurn = () => {
    if (!isMyTurn) return
    skipTurn()
    toast.info("Turn skipped")
  }

  // Handle leave game
  const handleLeaveGame = async () => {
    const confirmed = await confirm({
      title: "Leave Game",
      description: (
        <>
          Are you sure you want to leave this game? You will forfeit the match
          and your opponent will be declared the winner.
          <br />
          <br />
          This action cannot be undone.
        </>
      ),
      confirmText: "Leave Game",
      cancelText: "Cancel",
      variant: "destructive",
    })

    if (confirmed) {
      forfeitGame()
      toast.info("Game forfeited")
    }
  }

  // Handle activate ability
  const handleActivateAbility = async () => {
    const myAbilityCooldown =
      myPlayer === "host"
        ? (gameState?.host?.ability_cooldown ?? 4)
        : (gameState?.guest?.ability_cooldown ?? 4)

    const myAbilityActive =
      myPlayer === "host"
        ? (gameState?.host?.ability_active ?? false)
        : (gameState?.guest?.ability_active ?? false)

    if (myAbilityCooldown > 0 || !isMyTurn || myAbilityActive) return

    const confirmed = await confirm({
      title: "Activate Special Ability?",
      description: (
        <>
          <div className="font-semibold mb-2">
            Double Questions, Double Stakes!
          </div>
          <div>Your next card requires answering TWO questions:</div>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>
              <strong>Both correct:</strong> Double effect!
            </li>
            <li>
              <strong>Any wrong:</strong> Reverse effect on YOU
            </li>
          </ul>
          <div className="mt-3 text-amber-600 font-semibold">
            Cooldown: 4 turns after activation
          </div>
        </>
      ),
      confirmText: "Activate",
      cancelText: "Cancel",
    })

    if (confirmed) {
      activateAbility()
      toast.success("Special ability activated!")
    }
  }

  // Waiting states
  if (!isConnected) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-amber-500" />
          <p className="text-lg text-slate-300">Connecting to game...</p>
          {error && <p className="text-red-500 mt-2">{error}</p>}
        </div>
      </div>
    )
  }

  if (!gameState || gameState.status === "waiting") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-900">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-amber-500" />
          <p className="text-lg text-slate-300">Waiting for game to start...</p>
        </div>
      </div>
    )
  }

  // Detect opponent disconnection
  const isOpponentDisconnected =
    gameState.status === "in_progress" && opponentState === null

  return (
    <div
      className="fixed inset-0 w-full h-full bg-cover bg-center font-family-game"
      style={{ backgroundImage: "url(/assets/images/background-hobbit.avif)" }}
    >
      {/* 3D Game Canvas */}
      <Canvas
        camera={{ position: [0, 3, 8], fov: 60 }}
        className="w-full h-full"
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, 10, 10]} intensity={0.6} />

        {/* Opponent health bar */}
        {(opponentState || isOpponentDisconnected) && (
          <HealthBar3D
            currentHealth={
              isOpponentDisconnected
                ? (lastOpponentInfo?.health ?? 0)
                : (opponentState?.health ?? 0)
            }
            maxHealth={10}
            shield={
              isOpponentDisconnected
                ? (lastOpponentInfo?.shield ?? 0)
                : (opponentState?.shield ?? 0)
            }
            playerName={
              isOpponentDisconnected
                ? (lastOpponentInfo?.name ?? "Opponent")
                : (opponentState?.name ?? "Opponent")
            }
            position={[0, 2.5, 0]}
            isCurrentTurn={gameState.current_turn !== myPlayer}
            isPlayer={false}
            isDisconnected={isOpponentDisconnected}
          />
        )}

        {/* My health bar */}
        {myPlayerState && (
          <HealthBar3D
            currentHealth={myPlayerState.health}
            maxHealth={10}
            shield={myPlayerState.shield}
            playerName={myPlayerState.name}
            position={[0, -2.8, 0]}
            isCurrentTurn={isMyTurn}
            isPlayer={true}
            scale={1.6}
          />
        )}

        {/* Cards in hand */}
        {myHand.map((card, index) => {
          const totalCards = myHand.length
          const spacing = 1.8
          const startX = -((totalCards - 1) * spacing) / 2

          return (
            <Card3D
              key={`${card.card_key}-${index}`}
              name={card.name}
              cardType={card.card_type}
              effectData={card.effect_data}
              position={[startX + index * spacing, -3.5, 2]}
              rotation={[-0.3, 0, 0]}
              scale={1.1}
              onClick={() => handleCardClick(index)}
              isSelected={selectedCardIndex === index}
              isPlayable={isMyTurn && gameState.status === "in_progress"}
            />
          )
        })}

        {/* Deck indicator */}
        <OutlinedText
          position={[4, 0, 0]}
          fontSize={0.3}
          anchorX="center"
          anchorY="middle"
          font={GAME_FONT}
        >
          Deck: {gameState.deck_count}
        </OutlinedText>

        {/* Turn indicator */}
        <OutlinedText
          position={[0, 1, 0]}
          fontSize={0.25}
          textColor={isMyTurn ? COLORS.DARK_BROWN : COLORS.LIGHT_BROWN}
          anchorX="center"
          anchorY="middle"
          font={GAME_FONT}
        >
          {isMyTurn ? "YOUR TURN" : "OPPONENT'S TURN"}
        </OutlinedText>

        {/* Fatigue indicator */}
        {gameState.fatigue_damage > 0 && (
          <Text
            position={[-4, 0, 0]}
            fontSize={0.2}
            color="#dc2626"
            anchorX="center"
            anchorY="middle"
            font={GAME_FONT}
          >
            Fatigue: {gameState.fatigue_damage}
          </Text>
        )}

        {/* Result animation */}
        {showResultAnimation && lastResult && (
          <Text
            position={[0, 0.5, 3]}
            fontSize={0.5}
            color={
              lastResult.card.card_type === "basic_damage"
                ? "#ef4444"
                : lastResult.card.card_type === "basic_heal"
                  ? "#22c55e"
                  : lastResult.card.card_type === "basic_shield"
                    ? "#38bdf8"
                    : "#f9fafb"
            }
            anchorX="center"
            anchorY="middle"
            font={GAME_FONT}
          >
            {lastResult.is_correct ? "CORRECT!" : "WRONG!"}{" "}
            {lastResult.card.card_type === "basic_damage"
              ? `${lastResult.effect_value} DMG`
              : lastResult.card.card_type === "basic_heal"
                ? `+${lastResult.effect_value} HP`
                : lastResult.card.card_type === "basic_shield"
                  ? `+${lastResult.effect_value} Shield`
                  : `${lastResult.effect_value}`}
          </Text>
        )}

        <OrbitControls
          enableZoom={false}
          enablePan={false}
          maxPolarAngle={Math.PI / 2}
          minPolarAngle={Math.PI / 4}
        />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
        {/* Turn info */}
        <div className="bg-slate-900/90 backdrop-blur rounded-lg p-3 pointer-events-auto">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-500" />
            <span className="text-2xl font-bold text-white">
              {timerSeconds}s
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Turn {gameState.turn_number + 1}
          </p>
        </div>

        {/* Stats */}
        <div className="bg-slate-900/90 backdrop-blur rounded-lg p-3 pointer-events-auto">
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1">
              <Heart className="h-4 w-4 text-red-500" />
              <span className="text-white">{myPlayerState?.health ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-white">{myPlayerState?.shield ?? 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <Swords className="h-4 w-4 text-amber-500" />
              <span className="text-white">{myHand.length} cards</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {gameState?.status === "in_progress" && (
        <div className="absolute top-24 right-4 flex flex-col gap-2 pointer-events-auto">
          {/* Skip Turn Button - only visible on your turn */}
          {isMyTurn && (
            <Button
              variant="default"
              onClick={handleSkipTurn}
              className="bg-amber-600 hover:bg-amber-700 text-white font-semibold shadow-lg"
            >
              <SkipForward className="h-5 w-5 mr-2" />
              Skip Turn
            </Button>
          )}

          {/* Special Ability Button - only visible on your turn */}
          {isMyTurn &&
            (() => {
              const myAbilityCooldown =
                myPlayer === "host"
                  ? (gameState?.host?.ability_cooldown ?? 4)
                  : (gameState?.guest?.ability_cooldown ?? 4)

              const myAbilityActive =
                myPlayer === "host"
                  ? (gameState?.host?.ability_active ?? false)
                  : (gameState?.guest?.ability_active ?? false)

              return (
                <Button
                  variant={myAbilityActive ? "secondary" : "default"}
                  onClick={handleActivateAbility}
                  disabled={myAbilityCooldown > 0 || myAbilityActive}
                  className={cn("font-semibold shadow-lg", {
                    "bg-purple-600 hover:bg-purple-700 text-white":
                      myAbilityCooldown === 0 && !myAbilityActive,
                    "bg-gray-500 text-gray-300": myAbilityCooldown > 0,
                    "bg-green-600 text-white ring-2 ring-green-400":
                      myAbilityActive,
                  })}
                >
                  <Zap className="h-5 w-5 mr-2" />
                  {myAbilityActive
                    ? "Ability Active!"
                    : myAbilityCooldown > 0
                      ? `Cooldown: ${myAbilityCooldown}`
                      : "Special Ability"}
                </Button>
              )
            })()}

          {/* Leave Game Button - always visible during game */}
          <Button variant="destructive" onClick={handleLeaveGame}>
            <XCircle className="h-5 w-5 mr-2" />
            Leave Game
          </Button>
        </div>
      )}

      {/* First Question Popup */}
      <QuestionPopup
        isOpen={showQuestion && questionData !== null}
        question={questionData ?? null}
        cardName={myHand[selectedCardIndex ?? 0]?.name ?? "Card"}
        onSubmit={handleQuestionSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Second Question Popup (for ability) */}
      <QuestionPopup
        isOpen={showSecondQuestion && secondQuestion !== null}
        question={secondQuestion ?? null}
        cardName={myHand[selectedCardIndex ?? 0]?.name ?? "Card"}
        onSubmit={handleQuestionSubmit}
        isSubmitting={isSubmitting}
      />

      {/* Loading first question state */}
      {showQuestion && isLoadingQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-slate-900 p-6 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500" />
            <p className="text-center text-white mt-2">Loading question...</p>
          </div>
        </div>
      )}

      {/* Loading second question state (for ability) */}
      {isLoadingSecondQuestion && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-slate-900 p-6 rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-amber-500" />
            <p className="mt-2 text-slate-300">Loading question...</p>
          </div>
        </div>
      )}
    </div>
  )
}
