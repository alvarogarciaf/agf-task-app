export interface TourSampleFlags {
  hasSampleTask: boolean
  hasSampleProject: boolean
  hasSampleTags: boolean
}

export interface TourNavHelpers {
  isMobile: boolean
  navigateToHome: () => void
  setSidebarExpandedGroup: (groupKey: string, expanded: boolean) => void
  switchMobileSection: (section: "tasks" | "notes") => void
}

export interface TourStep {
  id: string
  kind: "welcome" | "spotlight" | "finish"
  desktopTarget?: string
  mobileTarget?: string
  title: string
  getDescription: (flags: TourSampleFlags) => string
  beforeShow?: (helpers: TourNavHelpers) => void
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    kind: "welcome",
    title: "Welcome to Tasks 👋",
    getDescription: () =>
      "Want a quick 1-minute tour of how your workspace is organized? You can skip at any time.",
    beforeShow: ({ isMobile, navigateToHome, switchMobileSection }) => {
      navigateToHome()
      if (isMobile) switchMobileSection("tasks")
    },
  },
  {
    id: "quick-capture",
    kind: "spotlight",
    desktopTarget: "quick-capture",
    mobileTarget: "quick-capture",
    title: "Capture anything, fast",
    getDescription: () =>
      "Type a task or thought and press Enter to save it right away. You can add a context, project, person, or urgency now—or organize it later.",
    beforeShow: ({ isMobile, navigateToHome, switchMobileSection }) => {
      navigateToHome()
      if (isMobile) switchMobileSection("tasks")
    },
  },
  {
    id: "inbox",
    kind: "spotlight",
    desktopTarget: "inbox-section",
    mobileTarget: "inbox-section",
    title: "Your Inbox",
    getDescription: ({ hasSampleTask }) =>
      hasSampleTask
        ? 'New captures land here until you triage them. Open an item to add a context or project, then tick the circle to mark it processed. Try it on "This is a sample task".'
        : "New captures land here until you triage them. Open an item to add a context or project, then tick the circle to mark it processed.",
    beforeShow: ({ isMobile, navigateToHome, switchMobileSection }) => {
      navigateToHome()
      if (isMobile) switchMobileSection("tasks")
    },
  },
  {
    id: "contexts",
    kind: "spotlight",
    desktopTarget: "nav-contexts",
    mobileTarget: "mobile-nav-contexts",
    title: "Contexts",
    getDescription: () =>
      "Contexts describe where or how you can do a task—like Home, Errands, or Work. Filter by a context to see only what you can act on right now.",
    beforeShow: ({ isMobile, switchMobileSection, setSidebarExpandedGroup }) => {
      if (isMobile) {
        switchMobileSection("tasks")
      } else {
        setSidebarExpandedGroup("contexts", true)
      }
    },
  },
  {
    id: "projects",
    kind: "spotlight",
    desktopTarget: "nav-projects",
    mobileTarget: "mobile-nav-projects",
    title: "Projects",
    getDescription: ({ hasSampleProject }) =>
      hasSampleProject
        ? 'Projects group related tasks and notes toward a single outcome. We created "My First Project" to get you started.'
        : "Projects group related tasks and notes toward a single outcome.",
    beforeShow: ({ isMobile, switchMobileSection, setSidebarExpandedGroup }) => {
      if (isMobile) {
        switchMobileSection("tasks")
      } else {
        setSidebarExpandedGroup("projects", true)
      }
    },
  },
  {
    id: "notes",
    kind: "spotlight",
    desktopTarget: "nav-notes",
    mobileTarget: "mobile-section-toggle",
    title: "Notes",
    getDescription: () =>
      "Notes hold reference material—ideas, meeting notes, and checklists. You can convert a note into a task (or vice versa) anytime.",
    beforeShow: ({ isMobile, switchMobileSection }) => {
      if (isMobile) {
        switchMobileSection("notes")
      }
    },
  },
  {
    id: "bookmarks",
    kind: "spotlight",
    desktopTarget: "nav-bookmarks",
    mobileTarget: "mobile-nav-bookmarks",
    title: "Bookmarks",
    getDescription: () =>
      "Bookmark the notes and tasks you open most often to keep them one click away.",
    beforeShow: ({ isMobile, switchMobileSection }) => {
      if (isMobile) {
        switchMobileSection("notes")
      }
    },
  },
  {
    id: "tags",
    kind: "spotlight",
    desktopTarget: "nav-tags",
    mobileTarget: "mobile-nav-tags",
    title: "Tags",
    getDescription: ({ hasSampleTags }) =>
      hasSampleTags
        ? 'Tags let you organize and filter your notes by topic. We added "Meeting notes" and "Health" to get you started.'
        : "Tags let you organize and filter your notes by topic.",
    beforeShow: ({ isMobile, switchMobileSection, setSidebarExpandedGroup }) => {
      if (isMobile) {
        switchMobileSection("notes")
      } else {
        setSidebarExpandedGroup("tags", true)
      }
    },
  },
  {
    id: "finish",
    kind: "finish",
    title: "You're all set!",
    getDescription: () =>
      "You're ready to start capturing. You can replay this tour anytime from Settings.",
    beforeShow: ({ isMobile, navigateToHome, switchMobileSection }) => {
      navigateToHome()
      if (isMobile) switchMobileSection("tasks")
    },
  },
]
