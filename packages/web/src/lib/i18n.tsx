import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useCategories } from "@/hooks/useCategories";

export type Locale = "en" | "tr";

const translations = {
  en: {
    // Nav
    "nav.today": "Today",
    "nav.week": "Week",
    "nav.calendar": "Calendar",
    "nav.stats": "Stats",
    "nav.search": "Search",
    "nav.recurring": "Recurring",
    "nav.signOut": "Sign out",
    "nav.switchTheme": "Switch to {theme} theme",

    // Categories
    "cat.dev": "Development",
    "cat.meeting": "Meeting",
    "cat.review": "Review",
    "cat.ops": "DevOps",
    "cat.learning": "Learning",
    "cat.personal": "Personal",
    "cat.other": "Other",

    // Days
    "day.sun": "Sun",
    "day.mon": "Mon",
    "day.tue": "Tue",
    "day.wed": "Wed",
    "day.thu": "Thu",
    "day.fri": "Fri",
    "day.sat": "Sat",

    // Recurrence
    "rec.daily": "Every day",
    "rec.weekdays": "Weekdays",
    "rec.weekly": "Weekly",
    "rec.custom": "Custom",

    // DayView
    "day.today": "Today",
    "day.planned": "Planned",
    "day.notes": "{count} note{s}",
    "day.noPlans": "No plans yet",
    "day.noPlansDesc": "Add what you want to accomplish",
    "day.noNotes": "No notes yet",
    "day.noNotesDesc": "Jot down quick thoughts or observations",
    "day.prevDay": "Previous day",
    "day.nextDay": "Next day",
    "day.goToday": "Go to today",
    "day.all": "All",
    "day.loading": "Loading day data",

    // TaskForm
    "form.addPlan": "Add a plan item",
    "form.addNote": "Add a note",
    "form.plan": "Plan",
    "form.quickNotes": "Quick Notes",
    "form.whatWillYouDo": "What will you do?",
    "form.addNotePlace": "Add a note...",
    "form.addTag": "Add tag...",
    "form.start": "Start",
    "form.duration": "Duration",
    "form.custom": "Custom",
    "form.add": "Add",
    "form.addedSuccess": "Added successfully",

    // PlanItem
    "plan.markAs": "Mark \"{desc}\" as {status}",
    "plan.delete": "Delete \"{desc}\"",
    "plan.confirmDelete": "Confirm delete \"{desc}\"",
    "plan.startPomodoro": "Start pomodoro for \"{desc}\"",
    "plan.done": "Done",
    "plan.skip": "Skip",
    "plan.complete": "complete",
    "plan.incomplete": "incomplete",

    // TaskItem
    "task.deleteNote": "Delete note",
    "task.confirmDelete": "Confirm delete",
    "task.edit": "Edit note",

    // Inline edit
    "edit.save": "Save",
    "edit.cancel": "Cancel",

    // Checklist
    "checklist.add": "Add a step...",

    // CarryOver
    "carry.incomplete": "{count} incomplete task{s} from yesterday",
    "carry.moving": "Moving...",
    "carry.carryOver": "Carry over",
    "carry.dismiss": "Dismiss",

    // Standup
    "standup.btn": "Standup",
    "standup.title": "Daily Standup",
    "standup.yesterday": "Yesterday:",
    "standup.today": "Today:",
    "standup.blockers": "Blockers/Carryover:",
    "standup.nothingCompleted": "(nothing completed)",
    "standup.noPlans": "(no plans yet)",
    "standup.copy": "Copy to clipboard",
    "standup.copied": "Copied!",

    // Pomodoro
    "pomo.title": "Pomodoro",
    "pomo.focus": "Focus",
    "pomo.break": "Break",
    "pomo.pause": "Pause",
    "pomo.start": "Start",
    "pomo.stopSave": "Stop and save",
    "pomo.reset": "Reset timer",
    "pomo.totalFocused": "Total focused: {m}m {s}s",

    // WeekView
    "week.title": "Week",
    "week.thisWeek": "This week",
    "week.prevWeek": "Previous week",
    "week.nextWeek": "Next week",
    "week.empty": "Empty",

    // Calendar
    "cal.title": "Calendar",
    "cal.prevMonth": "Previous month",
    "cal.nextMonth": "Next month",
    "cal.daysTracked": "Days Tracked",
    "cal.totalTasks": "Total Tasks",
    "cal.dayStreak": "Day Streak",
    "cal.tasks": "Tasks",
    "cal.plans": "Plans",
    "cal.activities": "{count} activities",

    // Stats
    "stats.title": "Statistics",
    "stats.completed": "Completed",
    "stats.timeTracked": "Time Tracked",
    "stats.streak": "Streak",
    "stats.daysActive": "Days Active",
    "stats.dailyActivity": "Daily Activity (Last 30 days)",
    "stats.byCategory": "By Category",
    "stats.timeByCategory": "Time by Category",
    "stats.noData": "No data yet",
    "stats.noDataDesc": "Start logging activities to see your stats here",
    "stats.loading": "Loading statistics",

    // Search
    "search.placeholder": "Search tasks, plans, notes...",
    "search.results": "{count} result{s} for \"{query}\"",
    "search.noResults": "No results found",
    "search.tryDifferent": "Try a different search term",
    "search.searchAll": "Search across all your days",
    "search.minChars": "Type at least 2 characters",

    // Recurring
    "recurring.title": "Recurring Tasks",
    "recurring.desc": "Auto-added to your daily plan",
    "recurring.taskDesc": "Task description...",
    "recurring.repeat": "Repeat",
    "recurring.pause": "Pause",
    "recurring.resume": "Resume",
    "recurring.noTasks": "No recurring tasks yet",
    "recurring.noTasksDesc": "Create tasks that auto-appear in your daily plan",
    "recurring.paused": "Paused",
    "recurring.everyDay": "Every day",
    "recurring.weekdays": "Weekdays",
    "recurring.every": "Every {day}",
    "recurring.create": "Create",
    "recurring.cancel": "Cancel",
    "recurring.delete": "Delete",

    // Reminders
    "reminder.title": "Reminders",
    "reminder.add": "Add reminder",
    "reminder.placeholder": "What should I remind you?",
    "reminder.empty": "No reminders for today",

    // Login
    "login.signIn": "Sign in",
    "login.signInDesc": "Sign in to continue",
    "login.register": "Register",
    "login.registerDesc": "Create your account",
    "login.email": "Email",
    "login.username": "Username",
    "login.password": "Password",
    "login.confirmPassword": "Confirm Password",
    "login.emailPlace": "you@example.com",
    "login.usernamePlace": "Choose a username",
    "login.passwordPlace": "Enter your password",
    "login.passwordPlaceNew": "Min 6 characters",
    "login.confirmPasswordPlace": "Confirm your password",
    "login.passwordsMismatch": "Passwords don't match",
    "login.error": "Something went wrong",
    "login.pendingApprovalError": "Your account is pending approval. You will be notified by email.",
    "login.pendingTitle": "Registration received",
    "login.pendingDesc": "Your account is under review. You will receive an email notification once approved.",
    "login.signingIn": "Signing in...",
    "login.creatingAccount": "Creating account...",
    "login.createAccount": "Create account",

    // Email verification
    "verify.banner": "Please verify your email address.",
    "verify.bannerLink": "Resend email",
    "verify.bannerSent": "Email sent!",
    "verify.bannerClose": "Dismiss",
    "verify.loading": "Verifying...",
    "verify.successTitle": "Email verified",
    "verify.successDesc": "Your email address has been verified successfully.",
    "verify.errorTitle": "Invalid link",
    "verify.errorDesc": "This verification link is invalid or has expired.",
    "verify.goApp": "Go to app",

    // Profile / Settings
    "profile.title": "Profile & Settings",
    "profile.account": "Account",
    "profile.preferences": "Preferences",
    "profile.security": "Security",
    "profile.displayName": "Display Name",
    "profile.displayNamePlace": "Your display name",
    "profile.bio": "Bio",
    "profile.bioPlace": "Tell something about yourself...",
    "profile.email": "Email",
    "profile.username": "Username",
    "profile.timezone": "Timezone",
    "profile.locale": "Language",
    "profile.theme": "Theme",
    "profile.themeSystem": "System",
    "profile.themeDark": "Dark",
    "profile.themeLight": "Light",
    "profile.pomodoro": "Pomodoro",
    "profile.pomodoroDuration": "Focus Duration",
    "profile.breakDuration": "Break Duration",
    "profile.minutes": "min",
    "profile.dailyGoal": "Daily Goal",
    "profile.dailyGoalPlace": "Tasks per day",
    "profile.workHours": "Work Hours",
    "profile.workStart": "Start",
    "profile.workEnd": "End",
    "profile.defaultCategory": "Default Category",
    "profile.isPublic": "Public Profile",
    "profile.isPublicDesc": "Allow others to see your profile",
    "profile.categories": "Custom Categories",
    "profile.categoryName": "Category name",
    "profile.noCustomCategories": "No custom categories yet",
    "profile.save": "Save Changes",
    "profile.saving": "Saving...",
    "profile.saved": "Changes saved",
    "profile.changePassword": "Change Password",
    "profile.currentPassword": "Current Password",
    "profile.newPassword": "New Password",
    "profile.confirmNewPassword": "Confirm New Password",
    "profile.passwordChanged": "Password changed successfully",
    "profile.passwordsMismatch": "Passwords don't match",
    "profile.memberSince": "Member since",
    "profile.deleteAccount": "Delete Account",
    "profile.deleteAccountDesc": "This action cannot be undone",
    "profile.nav": "Profile",
    "profile.notifications": "Notifications",
    "profile.phoneNumber": "Phone Number",
    "profile.phoneNumberDesc": "Used for SMS notifications",
    "profile.emailNotifications": "Email Notifications",
    "profile.emailNotificationsDesc": "Send plan & reminder alerts via email",
    "profile.smsNotifications": "SMS Notifications",
    "profile.smsNotificationsDesc": "Send plan & reminder alerts via SMS",

    // General
    "loading": "Loading...",
    "offline": "You are offline",
    "error.title": "Something went wrong",
    "error.desc": "An unexpected error occurred",
    "error.refresh": "Refresh page",

    // 404
    "notfound.title": "We looked everywhere",
    "notfound.desc": "Looks like this page got sucked into a black hole. It no longer exists.",
    "notfound.home": "Go to home",

    // Footer
    "footer.madeBy": "Made by",
    "footer.contact": "Contact",
    "footer.license": "MIT License",
    "footer.rights": "All rights reserved.",
    "footer.source": "Source",

    // Priority
    "priority.urgent": "Urgent",
    "priority.high": "High",
    "priority.normal": "Normal",

    // Category
    "cat.placeholder": "Category...",
    "cat.addNew": "Add new category",

    // Journal
    "journal.title": "Daily Journal",
    "journal.placeholder": "How did your day go? Write your thoughts...",
    "journal.wordCount": "{count} words",
    "journal.saved": "Saved",

    // Templates
    "templates.title": "Plan Templates",
    "templates.saveToday": "Save today as template",
    "templates.apply": "Apply",
    "templates.applied": "Applied",
    "templates.empty": "No templates yet",
    "templates.namePlace": "Template name...",
    "templates.planCount": "{count} plans",

    // Timeline
    "timeline.title": "Timeline",
    "timeline.empty": "No scheduled plans",
    "timeline.emptyDesc": "Add start times to plans",
    "timeline.unscheduled": "Unscheduled",
    "timeline.viewList": "List",
    "timeline.viewTimeline": "Timeline",

    // Copy day
    "day.copyYesterday": "Copy from yesterday",
    "day.copying": "Copying...",

    // Undo
    "undo.deleted": "\"{desc}\" deleted",
    "undo.undo": "Undo",

    // Shortcuts
    "shortcuts.title": "Keyboard Shortcuts",

    // Stats new
    "stats.estimateVsActual": "Estimate vs Actual",
    "stats.avgEstimate": "Avg Estimate",
    "stats.avgActual": "Avg Actual",
    "stats.accuracy": "Accuracy",
    "stats.completionByCategory": "Completion by Category",
    "stats.yearlyActivity": "Yearly Activity",
    "stats.less": "Less",
    "stats.more": "More",

    // Profile new
    "profile.webPush": "Web Push Notifications",
    "profile.webPushDesc": "Receive browser notifications",
    "profile.exportData": "Export",
    "profile.importData": "Import",
    "profile.exportDataDesc": "Download all your data as JSON",
    "profile.dataManagement": "Data Management",
    "profile.emailVerified": "Email verified",
    "profile.emailNotVerified": "Email not verified",
    "profile.resendVerification": "Send verification email",
    "profile.pushActive": "Active",
    "profile.pushEnable": "Enable",
    "profile.planNotifications": "Plan Notifications",
    "profile.planNotificationsDesc": "Get notified when a plan's scheduled time arrives",
    "profile.reminderNotifications": "Reminder Notifications",
    "profile.reminderNotificationsDesc": "Get notified when a reminder is due",
    "profile.viaEmail": "Email",
    "profile.viaSms": "SMS",
    "profile.viaPush": "Push",
    "profile.browserPush": "Browser Push",
    "profile.browserPushDesc": "Required for push notifications to work",
    "profile.notifyBefore": "Advance Notification",
    "profile.notifyBeforeDesc": "Send a push notification before a plan item starts",
    "profile.notifyBeforeOff": "Off",
    "profile.silentHours": "Silent Hours",
    "profile.silentHoursDesc": "No notifications during this time window",
    "profile.silentFrom": "From",
    "profile.silentTo": "To",

    // Projects
    "nav.projects": "Projects",
    "projects.title": "Projects",
    "projects.new": "New Project",
    "projects.empty": "You are not part of any project yet",
    "projects.emptyDesc": "Create a new project or wait for an invitation",
    "projects.name": "Project Name",
    "projects.key": "Project Key",
    "projects.keyHint": "2-10 uppercase letters (e.g. ALPHA, GMD2)",
    "projects.description": "Description",
    "projects.boardType": "Board Type",
    "projects.kanban": "Kanban",
    "projects.scrum": "Scrum",
    "projects.members": "{count} members",
    "projects.myRole": "My role",
    "projects.createBtn": "Create Project",
    "projects.creating": "Creating...",
    "projects.board": "Board",
    "projects.settings": "Settings",
    "projects.addIssue": "Add Issue",
    "projects.noIssues": "No tasks in this column",
    "projects.issueTitle": "Issue title",
    "projects.issueType": "Type",
    "projects.priority": "Priority",
    "projects.assignee": "Assignee",
    "projects.dueDate": "Due Date",
    "projects.addToPlan": "Add to Plan",
    "projects.inPlan": "In Plan",
    "projects.banner": "{count} assigned project task(s) not in your plan",
    "projects.view": "View →",
    "projects.loading": "Loading projects...",
    "projects.loadingBoard": "Loading board...",
    "issue.priority.critical": "Critical",
    "issue.priority.high": "High",
    "issue.priority.medium": "Medium",
    "issue.priority.low": "Low",
    "issue.priority.none": "None",
    "issue.type.epic": "Epic",
    "issue.type.story": "Story",
    "issue.type.task": "Task",
    "issue.type.bug": "Bug",
    "issue.type.sub_task": "Sub-task",
    // Issue detail
    "issue.description": "Description",
    "issue.descriptionPlaceholder": "Add a description...",
    "issue.comments": "Comments",
    "issue.noComments": "No comments yet",
    "issue.commentPlaceholder": "Write a comment...",
    "issue.addComment": "Comment",
    "issue.history": "Activity",
    "issue.noHistory": "No activity yet",
    "issue.status": "Status",
    "issue.reporter": "Reporter",
    "issue.created": "Created",
    "issue.updated": "Updated",
    "issue.unassigned": "Unassigned",
    "issue.noDescription": "No description",
    "issue.deleteIssue": "Delete Issue",
    "issue.deleteConfirm": "Delete this issue? This cannot be undone.",
    "issue.editComment": "Edit",
    "issue.deleteComment": "Delete",
    "issue.saveComment": "Save",
    "issue.cancelEdit": "Cancel",
    "issue.archive": "Archive",
    "issue.archiveConfirm": "Archive this issue? It can be restored later.",
    "issue.restore": "Restore",
    "issue.archivedIssues": "Archived Issues",
    "issue.noArchived": "No archived issues",
    // Members page
    "members.title": "Members",
    "members.invite": "Invite",
    "members.inviteEmail": "Email address",
    "members.inviteRole": "Role",
    "members.inviteSend": "Send Invite",
    "members.inviting": "Sending...",
    "members.inviteSent": "Invite sent!",
    "members.inviteError": "Failed to send invite",
    "members.remove": "Remove",
    "members.removeConfirm": "Remove this member from the project?",
    "members.leave": "Leave Project",
    "members.leaveConfirm": "Leave this project?",
    "members.transferOwner": "Transfer Ownership",
    "members.role.owner": "Owner",
    "members.role.admin": "Admin",
    "members.role.developer": "Developer",
    "members.role.reporter": "Reporter",
    "members.role.viewer": "Viewer",
    // Settings page
    "settings.title": "Project Settings",
    "settings.save": "Save Changes",
    "settings.saving": "Saving...",
    "settings.saved": "Saved",
    "settings.dangerZone": "Danger Zone",
    "settings.deleteProject": "Delete Project",
    "settings.deleteProjectDesc": "Permanently deletes this project and all its content.",
    "settings.deleteConfirm": "Type the project key to confirm:",
    "settings.deleting": "Deleting...",
    "settings.statuses": "Workflow Statuses",
    "settings.addStatus": "Add Status",
    "settings.statusName": "Status Name",
    "settings.statusCategory.todo": "To Do",
    "settings.statusCategory.in_progress": "In Progress",
    "settings.statusCategory.done": "Done",
    "settings.setDefault": "Set as Default",
    "settings.statusDefault": "Default",
  },
  tr: {
    // Nav
    "nav.today": "Bugün",
    "nav.week": "Hafta",
    "nav.calendar": "Takvim",
    "nav.stats": "İstatistik",
    "nav.search": "Arama",
    "nav.recurring": "Tekrar",
    "nav.signOut": "Çıkış yap",
    "nav.switchTheme": "{theme} temaya geç",

    // Categories
    "cat.dev": "Geliştirme",
    "cat.meeting": "Toplantı",
    "cat.review": "İnceleme",
    "cat.ops": "DevOps",
    "cat.learning": "Öğrenme",
    "cat.personal": "Kişisel",
    "cat.other": "Diğer",

    // Days
    "day.sun": "Paz",
    "day.mon": "Pzt",
    "day.tue": "Sal",
    "day.wed": "Çar",
    "day.thu": "Per",
    "day.fri": "Cum",
    "day.sat": "Cmt",

    // Recurrence
    "rec.daily": "Her gün",
    "rec.weekdays": "Hafta içi",
    "rec.weekly": "Haftalık",
    "rec.custom": "Özel",

    // DayView
    "day.today": "Bugün",
    "day.planned": "Planlanan",
    "day.notes": "{count} not",
    "day.noPlans": "Henüz plan yok",
    "day.noPlansDesc": "Yapmak istediklerini ekle",
    "day.noNotes": "Henüz not yok",
    "day.noNotesDesc": "Hızlı düşünceler veya gözlemler yaz",
    "day.prevDay": "Önceki gün",
    "day.nextDay": "Sonraki gün",
    "day.goToday": "Bugüne git",
    "day.all": "Tümü",
    "day.loading": "Gün verisi yükleniyor",

    // TaskForm
    "form.addPlan": "Plan ekle",
    "form.addNote": "Not ekle",
    "form.plan": "Plan",
    "form.quickNotes": "Hızlı Notlar",
    "form.whatWillYouDo": "Ne yapacaksın?",
    "form.addNotePlace": "Not ekle...",
    "form.addTag": "Etiket ekle...",
    "form.start": "Başlangıç",
    "form.duration": "Süre",
    "form.custom": "Özel",
    "form.add": "Ekle",
    "form.addedSuccess": "Başarıyla eklendi",

    // PlanItem
    "plan.markAs": "\"{desc}\" {status} olarak işaretle",
    "plan.delete": "\"{desc}\" sil",
    "plan.confirmDelete": "\"{desc}\" silmeyi onayla",
    "plan.startPomodoro": "\"{desc}\" için pomodoro başlat",
    "plan.done": "Tamam",
    "plan.skip": "Atla",
    "plan.complete": "tamamlandı",
    "plan.incomplete": "tamamlanmadı",

    // TaskItem
    "task.deleteNote": "Notu sil",
    "task.confirmDelete": "Silmeyi onayla",
    "task.edit": "Notu düzenle",

    // Inline edit
    "edit.save": "Kaydet",
    "edit.cancel": "İptal",

    // Checklist
    "checklist.add": "Adım ekle...",

    // CarryOver
    "carry.incomplete": "Dünden {count} tamamlanmamış görev",
    "carry.moving": "Taşınıyor...",
    "carry.carryOver": "Taşı",
    "carry.dismiss": "Kapat",

    // Standup
    "standup.btn": "Standup",
    "standup.title": "Günlük Standup",
    "standup.yesterday": "Dün:",
    "standup.today": "Bugün:",
    "standup.blockers": "Engeller/Devir:",
    "standup.nothingCompleted": "(tamamlanan yok)",
    "standup.noPlans": "(henüz plan yok)",
    "standup.copy": "Panoya kopyala",
    "standup.copied": "Kopyalandı!",

    // Pomodoro
    "pomo.title": "Pomodoro",
    "pomo.focus": "Odak",
    "pomo.break": "Mola",
    "pomo.pause": "Duraklat",
    "pomo.start": "Başlat",
    "pomo.stopSave": "Durdur ve kaydet",
    "pomo.reset": "Zamanlayıcıyı sıfırla",
    "pomo.totalFocused": "Toplam odak: {m}dk {s}sn",

    // WeekView
    "week.title": "Hafta",
    "week.thisWeek": "Bu hafta",
    "week.prevWeek": "Önceki hafta",
    "week.nextWeek": "Sonraki hafta",
    "week.empty": "Boş",

    // Calendar
    "cal.title": "Takvim",
    "cal.prevMonth": "Önceki ay",
    "cal.nextMonth": "Sonraki ay",
    "cal.daysTracked": "Takip Edilen",
    "cal.totalTasks": "Toplam Görev",
    "cal.dayStreak": "Seri",
    "cal.tasks": "Görevler",
    "cal.plans": "Planlar",
    "cal.activities": "{count} aktivite",

    // Stats
    "stats.title": "İstatistikler",
    "stats.completed": "Tamamlanan",
    "stats.timeTracked": "Takip Süresi",
    "stats.streak": "Seri",
    "stats.daysActive": "Aktif Gün",
    "stats.dailyActivity": "Günlük Aktivite (Son 30 gün)",
    "stats.byCategory": "Kategoriye Göre",
    "stats.timeByCategory": "Kategoriye Göre Süre",
    "stats.noData": "Henüz veri yok",
    "stats.noDataDesc": "İstatistikleri görmek için aktivite kaydetmeye başla",
    "stats.loading": "İstatistikler yükleniyor",

    // Search
    "search.placeholder": "Görev, plan, not ara...",
    "search.results": "\"{query}\" için {count} sonuç",
    "search.noResults": "Sonuç bulunamadı",
    "search.tryDifferent": "Farklı bir arama terimi dene",
    "search.searchAll": "Tüm günlerde ara",
    "search.minChars": "En az 2 karakter yaz",

    // Recurring
    "recurring.title": "Tekrarlayan Görevler",
    "recurring.desc": "Günlük planına otomatik eklenir",
    "recurring.taskDesc": "Görev açıklaması...",
    "recurring.repeat": "Tekrar",
    "recurring.pause": "Duraklat",
    "recurring.resume": "Devam et",
    "recurring.noTasks": "Henüz tekrarlayan görev yok",
    "recurring.noTasksDesc": "Günlük planında otomatik görünen görevler oluştur",
    "recurring.paused": "Duraklatıldı",
    "recurring.everyDay": "Her gün",
    "recurring.weekdays": "Hafta içi",
    "recurring.every": "Her {day}",
    "recurring.create": "Oluştur",
    "recurring.cancel": "İptal",
    "recurring.delete": "Sil",

    // Reminders
    "reminder.title": "Hatırlatıcılar",
    "reminder.add": "Hatırlatıcı ekle",
    "reminder.placeholder": "Ne hatırlatayım?",
    "reminder.empty": "Bugün için hatırlatıcı yok",

    // Login
    "login.signIn": "Giriş yap",
    "login.signInDesc": "Devam etmek için giriş yap",
    "login.register": "Kayıt ol",
    "login.registerDesc": "Hesabını oluştur",
    "login.email": "E-posta",
    "login.username": "Kullanıcı adı",
    "login.password": "Şifre",
    "login.confirmPassword": "Şifre Tekrar",
    "login.emailPlace": "ornek@email.com",
    "login.usernamePlace": "Kullanıcı adı seç",
    "login.passwordPlace": "Şifreni gir",
    "login.passwordPlaceNew": "En az 6 karakter",
    "login.confirmPasswordPlace": "Şifreni tekrar gir",
    "login.passwordsMismatch": "Şifreler eşleşmiyor",
    "login.error": "Bir şeyler yanlış gitti",
    "login.pendingApprovalError": "Hesabınız henüz onaylanmadı. Onaylanınca e-posta ile bildirim alacaksınız.",
    "login.pendingTitle": "Kayıt alındı",
    "login.pendingDesc": "Hesabınız inceleniyor. Admin onayladıktan sonra e-posta ile bildirim gönderilecek.",
    "login.signingIn": "Giriş yapılıyor...",
    "login.creatingAccount": "Hesap oluşturuluyor...",
    "login.createAccount": "Hesap oluştur",

    // Email verification
    "verify.banner": "E-posta adresinizi doğrulayın.",
    "verify.bannerLink": "Tekrar gönder",
    "verify.bannerSent": "E-posta gönderildi!",
    "verify.bannerClose": "Kapat",
    "verify.loading": "Doğrulanıyor...",
    "verify.successTitle": "E-posta doğrulandı",
    "verify.successDesc": "E-posta adresiniz başarıyla doğrulandı.",
    "verify.errorTitle": "Geçersiz link",
    "verify.errorDesc": "Bu doğrulama linki geçersiz veya süresi dolmuş.",
    "verify.goApp": "Uygulamaya git",

    // Profile / Settings
    "profile.title": "Profil ve Ayarlar",
    "profile.account": "Hesap",
    "profile.preferences": "Tercihler",
    "profile.security": "Güvenlik",
    "profile.displayName": "Görünen Ad",
    "profile.displayNamePlace": "Görünen adınız",
    "profile.bio": "Hakkında",
    "profile.bioPlace": "Kendiniz hakkında bir şeyler yazın...",
    "profile.email": "E-posta",
    "profile.username": "Kullanıcı Adı",
    "profile.timezone": "Saat Dilimi",
    "profile.locale": "Dil",
    "profile.theme": "Tema",
    "profile.themeSystem": "Sistem",
    "profile.themeDark": "Koyu",
    "profile.themeLight": "Açık",
    "profile.pomodoro": "Pomodoro",
    "profile.pomodoroDuration": "Odak Süresi",
    "profile.breakDuration": "Mola Süresi",
    "profile.minutes": "dk",
    "profile.dailyGoal": "Günlük Hedef",
    "profile.dailyGoalPlace": "Günlük görev sayısı",
    "profile.workHours": "Çalışma Saatleri",
    "profile.workStart": "Başlangıç",
    "profile.workEnd": "Bitiş",
    "profile.defaultCategory": "Varsayılan Kategori",
    "profile.isPublic": "Herkese Açık Profil",
    "profile.isPublicDesc": "Başkalarının profilinizi görmesine izin verin",
    "profile.categories": "Özel Kategoriler",
    "profile.categoryName": "Kategori adı",
    "profile.noCustomCategories": "Henüz özel kategori yok",
    "profile.save": "Değişiklikleri Kaydet",
    "profile.saving": "Kaydediliyor...",
    "profile.saved": "Değişiklikler kaydedildi",
    "profile.changePassword": "Şifre Değiştir",
    "profile.currentPassword": "Mevcut Şifre",
    "profile.newPassword": "Yeni Şifre",
    "profile.confirmNewPassword": "Yeni Şifre Tekrar",
    "profile.passwordChanged": "Şifre başarıyla değiştirildi",
    "profile.passwordsMismatch": "Şifreler eşleşmiyor",
    "profile.memberSince": "Üyelik tarihi",
    "profile.deleteAccount": "Hesabı Sil",
    "profile.deleteAccountDesc": "Bu işlem geri alınamaz",
    "profile.nav": "Profil",
    "profile.notifications": "Bildirimler",
    "profile.phoneNumber": "Telefon Numarası",
    "profile.phoneNumberDesc": "SMS bildirimleri için kullanılır",
    "profile.emailNotifications": "E-posta Bildirimleri",
    "profile.emailNotificationsDesc": "Plan ve hatırlatıcıları e-posta ile gönder",
    "profile.smsNotifications": "SMS Bildirimleri",
    "profile.smsNotificationsDesc": "Plan ve hatırlatıcıları SMS ile gönder",

    // General
    "loading": "Yükleniyor...",
    "offline": "Çevrimdışı",
    "error.title": "Bir sorun oluştu",
    "error.desc": "Beklenmeyen bir hata oluştu",
    "error.refresh": "Sayfayı yenile",

    // 404
    "notfound.title": "Her yeri aradık",
    "notfound.desc": "Bu sayfa bir kara deliğe kapılmış görünüyor. Artık mevcut değil.",
    "notfound.home": "Ana sayfaya dön",

    // Footer
    "footer.madeBy": "Yapımcı",
    "footer.contact": "İletişim",
    "footer.license": "MIT Lisans",
    "footer.rights": "Tüm hakları saklıdır.",
    "footer.source": "Kaynak Kod",

    // Priority
    "priority.urgent": "Acil",
    "priority.high": "Yüksek",
    "priority.normal": "Normal",

    // Category
    "cat.placeholder": "Kategori...",
    "cat.addNew": "Yeni kategori ekle",

    // Journal
    "journal.title": "Günlük",
    "journal.placeholder": "Bugünü nasıl geçirdin? Düşüncelerini yaz...",
    "journal.wordCount": "{count} kelime",
    "journal.saved": "Kaydedildi",

    // Templates
    "templates.title": "Plan Şablonları",
    "templates.saveToday": "Bugünü şablon olarak kaydet",
    "templates.apply": "Uygula",
    "templates.applied": "Uygulandı",
    "templates.empty": "Henüz şablon yok",
    "templates.namePlace": "Şablon adı...",
    "templates.planCount": "{count} plan",

    // Timeline
    "timeline.title": "Zaman Çizelgesi",
    "timeline.empty": "Zamanlanmış plan yok",
    "timeline.emptyDesc": "Planlara başlangıç saati ekleyin",
    "timeline.unscheduled": "Zamanlanmamış",
    "timeline.viewList": "Liste",
    "timeline.viewTimeline": "Zaman",

    // Copy day
    "day.copyYesterday": "Dünden kopyala",
    "day.copying": "Kopyalanıyor...",

    // Undo
    "undo.deleted": "\"{desc}\" silindi",
    "undo.undo": "Geri Al",

    // Shortcuts
    "shortcuts.title": "Klavye Kısayolları",

    // Stats new
    "stats.estimateVsActual": "Tahmin vs Gerçek",
    "stats.avgEstimate": "Ort. Tahmin",
    "stats.avgActual": "Ort. Gerçek",
    "stats.accuracy": "Doğruluk",
    "stats.completionByCategory": "Kategori Tamamlama Oranı",
    "stats.yearlyActivity": "Yıllık Aktivite",
    "stats.less": "Az",
    "stats.more": "Çok",

    // Profile new
    "profile.webPush": "Web Push Bildirimleri",
    "profile.webPushDesc": "Tarayıcı bildirimleri al",
    "profile.exportData": "Dışa Aktar",
    "profile.importData": "İçe Aktar",
    "profile.exportDataDesc": "Tüm verilerini JSON olarak indir",
    "profile.dataManagement": "Veri Yönetimi",
    "profile.emailVerified": "E-posta doğrulanmış",
    "profile.emailNotVerified": "E-posta doğrulanmamış",
    "profile.resendVerification": "Doğrulama e-postası gönder",
    "profile.pushActive": "Aktif",
    "profile.pushEnable": "Etkinleştir",
    "profile.planNotifications": "Plan Bildirimleri",
    "profile.planNotificationsDesc": "Plan saati geldiğinde bildirim al",
    "profile.reminderNotifications": "Hatırlatıcı Bildirimleri",
    "profile.reminderNotificationsDesc": "Hatırlatıcı zamanı geldiğinde bildirim al",
    "profile.viaEmail": "E-posta",
    "profile.viaSms": "SMS",
    "profile.viaPush": "Push",
    "profile.browserPush": "Tarayıcı Push",
    "profile.browserPushDesc": "Push bildirimleri için gerekli",
    "profile.notifyBefore": "Önceden Bildir",
    "profile.notifyBeforeDesc": "Plan saatinden önce push bildirimi gönder",
    "profile.notifyBeforeOff": "Kapalı",
    "profile.silentHours": "Sessiz Saatler",
    "profile.silentHoursDesc": "Bu zaman aralığında bildirim gönderilmez",
    "profile.silentFrom": "Başlangıç",
    "profile.silentTo": "Bitiş",

    // Projects
    "nav.projects": "Projeler",
    "projects.title": "Projeler",
    "projects.new": "Yeni Proje",
    "projects.empty": "Henüz bir projeye dahil değilsiniz",
    "projects.emptyDesc": "Yeni bir proje oluştur veya davet bekle",
    "projects.name": "Proje Adı",
    "projects.key": "Proje Kodu",
    "projects.keyHint": "2-10 büyük harf (örn. ALPHA, GMD2)",
    "projects.description": "Açıklama",
    "projects.boardType": "Pano Türü",
    "projects.kanban": "Kanban",
    "projects.scrum": "Scrum",
    "projects.members": "{count} üye",
    "projects.myRole": "Rolüm",
    "projects.createBtn": "Proje Oluştur",
    "projects.creating": "Oluşturuluyor...",
    "projects.board": "Pano",
    "projects.settings": "Ayarlar",
    "projects.addIssue": "Görev Ekle",
    "projects.noIssues": "Bu sütunda görev yok",
    "projects.issueTitle": "Görev başlığı",
    "projects.issueType": "Tür",
    "projects.priority": "Öncelik",
    "projects.assignee": "Atanan kişi",
    "projects.dueDate": "Bitiş Tarihi",
    "projects.addToPlan": "Planıma Ekle",
    "projects.inPlan": "Planda",
    "projects.banner": "{count} atanmış proje görevi planında değil",
    "projects.view": "Görüntüle →",
    "projects.loading": "Projeler yükleniyor...",
    "projects.loadingBoard": "Pano yükleniyor...",
    "issue.priority.critical": "Kritik",
    "issue.priority.high": "Yüksek",
    "issue.priority.medium": "Orta",
    "issue.priority.low": "Düşük",
    "issue.priority.none": "Yok",
    "issue.type.epic": "Epic",
    "issue.type.story": "Hikaye",
    "issue.type.task": "Görev",
    "issue.type.bug": "Hata",
    "issue.type.sub_task": "Alt Görev",
    // Issue detail
    "issue.description": "Açıklama",
    "issue.descriptionPlaceholder": "Açıklama ekle...",
    "issue.comments": "Yorumlar",
    "issue.noComments": "Henüz yorum yok",
    "issue.commentPlaceholder": "Yorum yaz...",
    "issue.addComment": "Yorum",
    "issue.history": "Aktivite",
    "issue.noHistory": "Henüz aktivite yok",
    "issue.status": "Durum",
    "issue.reporter": "Rapor Eden",
    "issue.created": "Oluşturuldu",
    "issue.updated": "Güncellendi",
    "issue.unassigned": "Atanmamış",
    "issue.noDescription": "Açıklama yok",
    "issue.deleteIssue": "Görevi Sil",
    "issue.deleteConfirm": "Bu görev silinsin mi? Bu işlem geri alınamaz.",
    "issue.editComment": "Düzenle",
    "issue.deleteComment": "Sil",
    "issue.saveComment": "Kaydet",
    "issue.cancelEdit": "İptal",
    "issue.archive": "Arşivle",
    "issue.archiveConfirm": "Görev arşivlensin mi? Daha sonra geri alınabilir.",
    "issue.restore": "Geri Yükle",
    "issue.archivedIssues": "Arşivlenmiş Görevler",
    "issue.noArchived": "Arşivlenmiş görev yok",
    // Members page
    "members.title": "Üyeler",
    "members.invite": "Davet Et",
    "members.inviteEmail": "E-posta adresi",
    "members.inviteRole": "Rol",
    "members.inviteSend": "Davet Gönder",
    "members.inviting": "Gönderiliyor...",
    "members.inviteSent": "Davet gönderildi!",
    "members.inviteError": "Davet gönderilemedi",
    "members.remove": "Çıkar",
    "members.removeConfirm": "Bu üyeyi projeden çıkar?",
    "members.leave": "Projeden Ayrıl",
    "members.leaveConfirm": "Bu projeden ayrıl?",
    "members.transferOwner": "Sahipliği Devret",
    "members.role.owner": "Sahip",
    "members.role.admin": "Yönetici",
    "members.role.developer": "Geliştirici",
    "members.role.reporter": "Raporlayan",
    "members.role.viewer": "İzleyici",
    // Settings page
    "settings.title": "Proje Ayarları",
    "settings.save": "Değişiklikleri Kaydet",
    "settings.saving": "Kaydediliyor...",
    "settings.saved": "Kaydedildi",
    "settings.dangerZone": "Tehlikeli Bölge",
    "settings.deleteProject": "Projeyi Sil",
    "settings.deleteProjectDesc": "Bu projeyi ve tüm içeriğini kalıcı olarak siler.",
    "settings.deleteConfirm": "Onaylamak için proje anahtarını yazın:",
    "settings.deleting": "Siliniyor...",
    "settings.statuses": "Workflow Durumları",
    "settings.addStatus": "Durum Ekle",
    "settings.statusName": "Durum Adı",
    "settings.statusCategory.todo": "Yapılacak",
    "settings.statusCategory.in_progress": "Devam Ediyor",
    "settings.statusCategory.done": "Tamamlandı",
    "settings.setDefault": "Varsayılan Yap",
    "settings.statusDefault": "Varsayılan",
  },
} as const;

type TranslationKey = keyof typeof translations.en;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | null>(null);

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem("gmd-locale");
    if (stored === "tr" || stored === "en") return stored;
  } catch {}
  return "tr";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("gmd-locale", l);
    document.documentElement.lang = l;
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = (translations[locale] as Record<string, string>)[key] || (translations.en as Record<string, string>)[key] || key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
      }
    }
    return text;
  };

  return (
    <I18nContext value={{ locale, setLocale, t }}>
      {children}
    </I18nContext>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

// Helper to get category label via i18n
const CATEGORY_KEYS: Record<string, TranslationKey> = {
  dev: "cat.dev",
  meeting: "cat.meeting",
  review: "cat.review",
  ops: "cat.ops",
  learning: "cat.learning",
  personal: "cat.personal",
  other: "cat.other",
};

export function useCategoryLabel() {
  const { t } = useI18n();
  const { getCategoryLabel } = useCategories();
  return (cat: string) => {
    if (CATEGORY_KEYS[cat]) return t(CATEGORY_KEYS[cat]);
    return getCategoryLabel(cat);
  };
}

const DAY_KEYS: TranslationKey[] = ["day.sun", "day.mon", "day.tue", "day.wed", "day.thu", "day.fri", "day.sat"];

export function useDayLabels() {
  const { t } = useI18n();
  return DAY_KEYS.map((k) => t(k));
}

const RECURRENCE_KEYS: Record<string, TranslationKey> = {
  daily: "rec.daily",
  weekdays: "rec.weekdays",
  weekly: "rec.weekly",
  custom: "rec.custom",
};

export function useRecurrenceLabel() {
  const { t } = useI18n();
  return (rec: string) => t(RECURRENCE_KEYS[rec] || "rec.custom");
}
