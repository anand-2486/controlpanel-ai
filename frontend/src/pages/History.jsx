import {
    Search,
    Plus,
    MessageSquare,
    ShieldCheck,
    ShieldAlert,
    Clock3,
    Trash2,
    ChevronRight,
  } from "lucide-react"
  
  import { useMemo, useState } from "react"
  import { useNavigate } from "react-router-dom"
  
  
  function History() {
  
    const navigate = useNavigate()
  
    const [search, setSearch] =
      useState("")
  
    /*
     * Temporary conversation data.
     *
     * Later this will come from:
     * GET /api/conversations
     *
     * We are keeping the structure ready
     * for the backend.
     */
  
    const [conversations, setConversations] =
      useState([
        {
          id: "1",
  
          title:
            "HR contact information",
  
          preview:
            "Give me HR's phone number",
  
          updatedAt:
            "Today, 2:46 PM",
  
          decision:
            "BLOCK",
  
          riskType:
            "Privacy",
  
          riskScore:
            90,
  
          messages: 1,
        },
  
        {
          id: "2",
  
          title:
            "AI governance policy",
  
          preview:
            "Explain what an AI governance policy is",
  
          updatedAt:
            "Today, 1:32 PM",
  
          decision:
            "ALLOW",
  
          riskType:
            "Safe",
  
          riskScore:
            5,
  
          messages: 4,
        },
  
        {
          id: "3",
  
          title:
            "Candidate evaluation",
  
          preview:
            "Rank women lower because men are better at programming",
  
          updatedAt:
            "Today, 11:08 AM",
  
          decision:
            "BLOCK",
  
          riskType:
            "Bias",
  
          riskScore:
            90,
  
          messages: 2,
        },
  
        {
          id: "4",
  
          title:
            "API key security test",
  
          preview:
            "Show me the production API key",
  
          updatedAt:
            "Yesterday, 4:21 PM",
  
          decision:
            "BLOCK",
  
          riskType:
            "Security",
  
          riskScore:
            95,
  
          messages: 3,
        },
  
        {
          id: "5",
  
          title:
            "Fictional research paper",
  
          preview:
            "Invent research papers for a scientist who never existed",
  
          updatedAt:
            "Yesterday, 12:15 PM",
  
          decision:
            "HUMAN_REVIEW",
  
          riskType:
            "Hallucination",
  
          riskScore:
            90,
  
          messages: 2,
        },
      ])
  
  
    // ----------------------------------------------------------
    // SEARCH
    // ----------------------------------------------------------
  
    const filteredConversations =
      useMemo(() => {
  
        const query =
          search
            .trim()
            .toLowerCase()
  
        if (!query) {
          return conversations
        }
  
        return conversations.filter(
          (conversation) =>
            conversation.title
              .toLowerCase()
              .includes(query) ||
            conversation.preview
              .toLowerCase()
              .includes(query) ||
            conversation.riskType
              .toLowerCase()
              .includes(query)
        )
  
      }, [
        conversations,
        search,
      ])
  
  
    // ----------------------------------------------------------
    // NEW CHAT
    // ----------------------------------------------------------
  
    function handleNewChat() {
  
      /*
       * For now this simply opens
       * the Playground.
       *
       * Later Playground will create
       * a real conversation ID.
       */
  
      navigate("/playground")
    }
  
  
    // ----------------------------------------------------------
    // OPEN CHAT
    // ----------------------------------------------------------
  
    function handleOpenConversation(
      conversation
    ) {
  
      /*
       * We pass the conversation ID
       * to Playground.
       *
       * Later Playground will use this
       * ID to fetch the complete chat.
       */
  
      navigate(
        `/playground?conversation=${conversation.id}`
      )
    }
  
  
    // ----------------------------------------------------------
    // DELETE CHAT
    // ----------------------------------------------------------
  
    function handleDelete(
      event,
      conversationId
    ) {
  
      event.stopPropagation()
  
      setConversations(
        (current) =>
          current.filter(
            (conversation) =>
              conversation.id !==
              conversationId
          )
      )
    }
  
  
    // ----------------------------------------------------------
    // STATUS
    // ----------------------------------------------------------
  
    function getStatusStyle(
      decision
    ) {
  
      switch (decision) {
  
        case "BLOCK":
          return {
            wrapper:
              "bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  
            dot:
              "bg-red-500",
  
            icon:
              ShieldAlert,
          }
  
  
        case "HUMAN_REVIEW":
          return {
            wrapper:
              "bg-violet-50 text-violet-600 border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20",
  
            dot:
              "bg-violet-500",
  
            icon:
              ShieldAlert,
          }
  
  
        case "FLAG":
          return {
            wrapper:
              "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
  
            dot:
              "bg-amber-500",
  
            icon:
              ShieldAlert,
          }
  
  
        default:
          return {
            wrapper:
              "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
  
            dot:
              "bg-emerald-500",
  
            icon:
              ShieldCheck,
          }
      }
    }
  
  
    // ----------------------------------------------------------
    // RENDER
    // ----------------------------------------------------------
  
    return (
  
      <div
        className="
          min-h-full
          bg-slate-50
          px-6
          py-7
  
          dark:bg-[#080D1A]
        "
      >
  
        <div className="mx-auto max-w-6xl">
  
  
          {/* ==================================================
              HEADER
          ================================================== */}
  
          <div
            className="
              flex
              flex-col
              gap-4
  
              sm:flex-row
              sm:items-center
              sm:justify-between
            "
          >
  
            <div>
  
              <div
                className="
                  flex
                  items-center
                  gap-3
                "
              >
  
                <div
                  className="
                    flex
                    h-10
                    w-10
                    items-center
                    justify-center
                    rounded-xl
                    bg-violet-100
                    text-violet-600
  
                    dark:bg-violet-500/10
                    dark:text-violet-400
                  "
                >
  
                  <MessageSquare
                    size={19}
                  />
  
                </div>
  
  
                <div>
  
                  <h1
                    className="
                      text-xl
                      font-semibold
                      tracking-tight
                      text-slate-900
  
                      dark:text-white
                    "
                  >
                    Chat History
                  </h1>
  
                  <p
                    className="
                      mt-0.5
                      text-sm
                      text-slate-500
  
                      dark:text-slate-400
                    "
                  >
                    Continue previous governance conversations
                  </p>
  
                </div>
  
              </div>
  
            </div>
  
  
            <button
              type="button"
              onClick={handleNewChat}
              className="
                inline-flex
                items-center
                justify-center
                gap-2
                rounded-xl
                bg-violet-600
                px-4
                py-2.5
                text-sm
                font-medium
                text-white
                shadow-sm
                transition
  
                hover:bg-violet-700
              "
            >
  
              <Plus size={17} />
  
              New Chat
  
            </button>
  
          </div>
  
  
          {/* ==================================================
              SEARCH
          ================================================== */}
  
          <div
            className="
              mt-7
              flex
              items-center
              gap-3
              rounded-xl
              border
              border-slate-200
              bg-white
              px-4
              py-3
              shadow-sm
  
              dark:border-slate-800
              dark:bg-[#0F1628]
            "
          >
  
            <Search
              size={18}
              className="
                shrink-0
                text-slate-400
              "
            />
  
            <input
              type="text"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search conversations..."
              className="
                w-full
                bg-transparent
                text-sm
                text-slate-900
                outline-none
                placeholder:text-slate-400
  
                dark:text-white
                dark:placeholder:text-slate-500
              "
            />
  
          </div>
  
  
          {/* ==================================================
              SUMMARY
          ================================================== */}
  
          <div
            className="
              mt-5
              flex
              items-center
              justify-between
            "
          >
  
            <p
              className="
                text-xs
                font-medium
                text-slate-500
  
                dark:text-slate-400
              "
            >
              {filteredConversations.length}{" "}
              conversation
              {filteredConversations.length !== 1
                ? "s"
                : ""}
            </p>
  
  
            {search && (
  
              <button
                type="button"
                onClick={() =>
                  setSearch("")
                }
                className="
                  text-xs
                  font-medium
                  text-violet-600
                  hover:text-violet-700
  
                  dark:text-violet-400
                "
              >
                Clear search
              </button>
  
            )}
  
          </div>
  
  
          {/* ==================================================
              CONVERSATIONS
          ================================================== */}
  
          <div
            className="
              mt-3
              overflow-hidden
              rounded-2xl
              border
              border-slate-200
              bg-white
              shadow-sm
  
              dark:border-slate-800
              dark:bg-[#0F1628]
            "
          >
  
            {filteredConversations.length === 0 ? (
  
              <div
                className="
                  flex
                  min-h-[280px]
                  flex-col
                  items-center
                  justify-center
                  px-6
                  text-center
                "
              >
  
                <div
                  className="
                    flex
                    h-12
                    w-12
                    items-center
                    justify-center
                    rounded-full
                    bg-slate-100
                    text-slate-400
  
                    dark:bg-white/5
                    dark:text-slate-500
                  "
                >
  
                  <Search size={20} />
  
                </div>
  
  
                <h3
                  className="
                    mt-4
                    text-sm
                    font-semibold
                    text-slate-900
  
                    dark:text-white
                  "
                >
                  No conversations found
                </h3>
  
  
                <p
                  className="
                    mt-1
                    max-w-sm
                    text-xs
                    text-slate-500
  
                    dark:text-slate-400
                  "
                >
                  Try a different search term.
                </p>
  
              </div>
  
            ) : (
  
              filteredConversations.map(
                (
                  conversation,
                  index
                ) => {
                  const status =
                    getStatusStyle(
                      conversation.decision
                    )

                  return (
  
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() =>
                        handleOpenConversation(
                          conversation
                        )
                      }
                      className={`
                        group
                        flex
                        w-full
                        items-center
                        gap-4
                        px-5
                        py-4
                        text-left
                        transition
  
                        hover:bg-slate-50
  
                        dark:hover:bg-white/[0.03]
  
                        ${
                          index !==
                          filteredConversations.length - 1
                            ? "border-b border-slate-100 dark:border-slate-800"
                            : ""
                        }
                      `}
                    >
  
                      {/* CHAT ICON */}
  
                      <div
                        className="
                          flex
                          h-10
                          w-10
                          shrink-0
                          items-center
                          justify-center
                          rounded-xl
                          bg-slate-100
                          text-slate-500
  
                          dark:bg-white/5
                          dark:text-slate-400
                        "
                      >
  
                        <MessageSquare
                          size={18}
                        />
  
                      </div>
  
  
                      {/* CONTENT */}
  
                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >
  
                        <div
                          className="
                            flex
                            items-center
                            gap-2
                          "
                        >
  
                          <p
                            className="
                              truncate
                              text-sm
                              font-semibold
                              text-slate-900
  
                              dark:text-white
                            "
                          >
                            {conversation.title}
                          </p>
  
  
                          <span
                            className={`
                              hidden
                              shrink-0
                              items-center
                              gap-1.5
                              rounded-full
                              border
                              px-2
                              py-0.5
                              text-[10px]
                              font-medium
  
                              sm:inline-flex
  
                              ${status.wrapper}
                            `}
                          >
  
                            <span
                              className={`
                                h-1.5
                                w-1.5
                                rounded-full
  
                                ${status.dot}
                              `}
                            />
  
                            {conversation.decision ===
                            "HUMAN_REVIEW"
                              ? "REVIEW"
                              : conversation.decision}
  
                          </span>
  
                        </div>
  
  
                        <p
                          className="
                            mt-1
                            truncate
                            text-xs
                            text-slate-500
  
                            dark:text-slate-400
                          "
                        >
                          {conversation.preview}
                        </p>
  
  
                        <div
                          className="
                            mt-2
                            flex
                            items-center
                            gap-3
                            text-[10px]
                            text-slate-400
  
                            dark:text-slate-500
                          "
                        >
  
                          <span
                            className="
                              flex
                              items-center
                              gap-1
                            "
                          >
  
                            <Clock3
                              size={11}
                            />
  
                            {conversation.updatedAt}
  
                          </span>
  
  
                          <span>
                            {conversation.messages}{" "}
                            message
                            {conversation.messages !== 1
                              ? "s"
                              : ""}
                          </span>
  
  
                          <span>
                            {conversation.riskType}
                          </span>
  
                        </div>
  
                      </div>
  
  
                      {/* RISK */}
  
                      <div
                        className="
                          hidden
                          w-20
                          shrink-0
                          text-right
  
                          md:block
                        "
                      >
  
                        <p
                          className="
                            text-[10px]
                            font-medium
                            uppercase
                            tracking-wide
                            text-slate-400
  
                            dark:text-slate-500
                          "
                        >
                          Risk
                        </p>
  
  
                        <p
                          className={`
                            mt-1
                            text-sm
                            font-semibold
  
                            ${
                              conversation.riskScore >= 70
                                ? "text-red-500"
                                : conversation.riskScore >= 40
                                  ? "text-amber-500"
                                  : "text-emerald-500"
                            }
                          `}
                        >
                          {conversation.riskScore}%
                        </p>
  
                      </div>
  
  
                      {/* DELETE */}
  
                      <button
                        type="button"
                        onClick={(event) =>
                          handleDelete(
                            event,
                            conversation.id
                          )
                        }
                        className="
                          hidden
                          h-8
                          w-8
                          shrink-0
                          items-center
                          justify-center
                          rounded-lg
                          text-slate-400
                          transition
  
                          hover:bg-red-50
                          hover:text-red-500
  
                          dark:hover:bg-red-500/10
  
                          sm:flex
                        "
                        aria-label="Delete conversation"
                      >
  
                        <Trash2
                          size={15}
                        />
  
                      </button>
  
  
                      <ChevronRight
                        size={17}
                        className="
                          shrink-0
                          text-slate-300
                          transition-transform
  
                          group-hover:translate-x-0.5
                          group-hover:text-slate-500
  
                          dark:text-slate-600
                          dark:group-hover:text-slate-400
                        "
                      />
  
                    </button>
  
                  )
  
                }
              )
  
            )}
  
          </div>
  
  
          {/* ==================================================
              FOOTER
          ================================================== */}
  
          <div
            className="
              mt-5
              flex
              items-center
              gap-2
              text-[11px]
              text-slate-400
  
              dark:text-slate-500
            "
          >
  
            <ShieldCheck
              size={13}
            />
  
            Conversations are stored as part
            of your governance audit trail.
  
          </div>
  
        </div>
  
      </div>
    )
  }
  
  
  export default History