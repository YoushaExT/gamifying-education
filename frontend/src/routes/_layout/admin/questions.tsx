import type { QueryClient } from "@tanstack/react-query"
import { useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { Edit, Eye, HelpCircle, Trash2 } from "lucide-react"
import { useId, useState } from "react"
import { z } from "zod"

import {
  type QuestionPublic,
  QuestionsService,
  SubjectsService,
  TopicsService,
} from "@/client"
import AddQuestion from "@/components/Questions/AddQuestion"
import { useDeleteQuestion } from "@/components/Questions/useDeleteQuestion"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Container } from "@/components/ui/container"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"
import { MODAL_IDS } from "@/services/modals/ModalRegistry"
import ModalService from "@/services/modals/ModalService"

// Helper function to strip HTML tags for preview
function stripHtmlTags(html: string): string {
  const tmp = document.createElement("DIV")
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ""
}

const questionsSearchSchema = z.object({
  page: z.number().catch(1),
})

const PER_PAGE = 10

function getQuestionsQueryOptions({
  page,
  subject,
  topic,
}: {
  page: number
  subject?: string
  topic?: string
}) {
  return {
    queryFn: () =>
      QuestionsService.readQuestions({
        skip: (page - 1) * PER_PAGE,
        limit: PER_PAGE,
        subject: subject || null,
        topic: topic || null,
      }),
    queryKey: ["questions", { page, subject, topic }],
  }
}

export const Route = createFileRoute("/_layout/admin/questions")({
  component: Questions,
  validateSearch: (search) => questionsSearchSchema.parse(search),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: async ({ context, deps: { page } }) => {
    const { queryClient } = context as { queryClient: QueryClient }
    await queryClient.ensureQueryData(getQuestionsQueryOptions({ page }))
  },
})

function Questions() {
  const { page } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const [subjectFilter, setSubjectFilter] = useState("")
  const [topicFilter, setTopicFilter] = useState("")
  const subjectFilterId = useId()
  const topicFilterId = useId()

  const setPage = (page: number) =>
    navigate({ search: (prev) => ({ ...prev, page }) })

  // Fetch subjects and topics for dropdowns
  const { data: subjectsData } = useQuery({
    queryKey: ["subjects"],
    queryFn: () => SubjectsService.readSubjects({ limit: 1000 }),
  })

  const { data: topicsData } = useQuery({
    queryKey: ["topics"],
    queryFn: () => TopicsService.readTopics({ limit: 1000 }),
  })

  const subjects = subjectsData?.data.map((s) => s.name).sort() || []
  const topics = topicsData?.data.map((t) => t.name).sort() || []

  const {
    data: questions,
    isPending,
    isPlaceholderData,
  } = useQuery({
    ...getQuestionsQueryOptions({
      page,
      subject: subjectFilter,
      topic: topicFilter,
    }),
    placeholderData: (prevData) => prevData,
  })

  const hasNextPage = !isPlaceholderData && questions?.data.length === PER_PAGE
  const hasPreviousPage = page > 1
  const totalPages = questions?.count
    ? Math.ceil(questions.count / PER_PAGE)
    : 1

  const handleApplyFilters = () => {
    setPage(1)
  }

  const handleClearFilters = () => {
    setSubjectFilter("")
    setTopicFilter("")
    setPage(1)
  }

  return (
    <Container maxW="full">
      <div className="pt-12 px-4 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Questions Management</h1>
          <AddQuestion />
        </div>

        {/* Filters */}
        <div className="flex gap-4 items-end border rounded-lg p-4 bg-muted/50">
          <div className="flex-1 space-y-2">
            <Label htmlFor={subjectFilterId}>Subject</Label>
            <Combobox
              options={subjects}
              value={subjectFilter}
              onValueChange={setSubjectFilter}
              placeholder="All Subjects"
              emptyText="No subject found."
              searchPlaceholder="Search subjects..."
              allowAddNew={false}
            />
          </div>
          <div className="flex-1 space-y-2">
            <Label htmlFor={topicFilterId}>Topic</Label>
            <Combobox
              options={topics}
              value={topicFilter}
              onValueChange={setTopicFilter}
              placeholder="All Topics"
              emptyText="No topic found."
              searchPlaceholder="Search topics..."
              allowAddNew={false}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleApplyFilters}>Apply</Button>
            <Button variant="outline" onClick={handleClearFilters}>
              Clear
            </Button>
          </div>
        </div>

        {isPending ? (
          <div className="flex justify-center py-12">
            <div className="text-muted-foreground">Loading questions...</div>
          </div>
        ) : questions?.data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 border border-dashed rounded-lg">
            <HelpCircle className="size-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No questions found</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Get started by creating your first question.
            </p>
            <AddQuestion />
          </div>
        ) : (
          <>
            <div className="rounded-md border">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-4 text-left text-sm font-medium">
                      Question
                    </th>
                    <th className="p-4 text-left text-sm font-medium w-32">
                      Subject
                    </th>
                    <th className="p-4 text-left text-sm font-medium w-32">
                      Topic
                    </th>
                    <th className="p-4 text-left text-sm font-medium w-24">
                      Answers
                    </th>
                    <th className="p-4 text-left text-sm font-medium w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {questions?.data.map((question) => (
                    <tr
                      key={question.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="p-4 text-sm">
                        {stripHtmlTags(question.question_text).substring(
                          0,
                          100,
                        )}
                        {stripHtmlTags(question.question_text).length > 100
                          ? "..."
                          : ""}
                      </td>
                      <td className="p-4 text-sm">{question.subject}</td>
                      <td className="p-4 text-sm text-muted-foreground">
                        {question.topic || "N/A"}
                      </td>
                      <td className="p-4 text-sm">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            question.correct_answers.length > 1
                              ? "bg-blue-100 text-blue-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {question.correct_answers
                            .map((idx) => String.fromCharCode(65 + idx))
                            .join(", ")}
                        </span>
                      </td>
                      <td className="p-4">
                        <QuestionActionsMenu question={question} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={!hasPreviousPage}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={!hasNextPage}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </Container>
  )
}

interface QuestionActionsMenuProps {
  question: QuestionPublic
}

function QuestionActionsMenu({ question }: QuestionActionsMenuProps) {
  const { deleteQuestion } = useDeleteQuestion()

  const handlePreview = () => {
    ModalService.openModalById(MODAL_IDS.PREVIEW_QUESTION, {
      question,
      className: "max-w-3xl",
    })
  }

  const handleEdit = () => {
    ModalService.openModalById(MODAL_IDS.EDIT_QUESTION, {
      question,
      className: "sm:max-w-[700px]",
    })
  }

  const handleDelete = () => {
    deleteQuestion(question.id, stripHtmlTags(question.question_text))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm">
          •••
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={handlePreview}>
          <Eye className="mr-2 size-4" />
          Preview
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleEdit}>
          <Edit className="mr-2 size-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={handleDelete} className="text-destructive">
          <Trash2 className="mr-2 size-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
