import type { ReactNode } from 'react';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import WordManagementPage from './pages/WordManagementPage';
import AddWordPage from './pages/AddWordPage';
import ImportWordsPage from './pages/ImportWordsPage';
import EditCollectionPage from './pages/EditCollectionPage';
import StudyModeSelectPage from './pages/StudyModeSelectPage';
import EnglishChineseModeSelectPage from './pages/EnglishChineseModeSelectPage';
import ChineseEnglishModeSelectPage from './pages/ChineseEnglishModeSelectPage';
import EnglishChineseQuizPage from './pages/EnglishChineseQuizPage';
import ChineseEnglishQuizPage from './pages/ChineseEnglishQuizPage';
import MixedQuizPage from './pages/MixedQuizPage';
import QuizResultPage from './pages/QuizResultPage';
import ReadAloudSettingsPage from './pages/ReadAloudSettingsPage';
import ReadAloudPage from './pages/ReadAloudPage';
import WrongWordsPage from './pages/WrongWordsPage';
import WrongWordsModeSelectionPage from './pages/WrongWordsModeSelectionPage';
import WrongWordsPracticeEnglishChineseSettingsPage from './pages/WrongWordsPracticeEnglishChineseSettingsPage';
import WrongWordsPracticeChineseEnglishSettingsPage from './pages/WrongWordsPracticeChineseEnglishSettingsPage';
import WrongWordsPracticeMixedSettingsPage from './pages/WrongWordsPracticeMixedSettingsPage';
import WrongWordsPracticePage from './pages/WrongWordsPracticePage';
import StatisticsPage from './pages/StatisticsPage';
import SettingsPage from './pages/SettingsPage';
import DataManagementPage from './pages/DataManagementPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  /** Accessible without login. Routes without this flag require authentication. Has no effect when RouteGuard is not in use. */
  public?: boolean;
}

const routes: RouteConfig[] = [
  {
    name: 'Welcome',
    path: '/',
    element: <WelcomePage />,
    public: true,
  },
  {
    name: 'Home',
    path: '/home',
    element: <HomePage />,
    public: true,
  },
  {
    name: 'Word Management',
    path: '/words',
    element: <WordManagementPage />,
    public: true,
  },
  {
    name: 'Add Word',
    path: '/words/add',
    element: <AddWordPage />,
    public: true,
  },
  {
    name: 'Import Words',
    path: '/words/import',
    element: <ImportWordsPage />,
    public: true,
  },
  {
    name: 'Edit Collection',
    path: '/words/edit/:collectionId',
    element: <EditCollectionPage />,
    public: true,
  },
  {
    name: 'Study Mode Select',
    path: '/study-mode',
    element: <StudyModeSelectPage />,
    public: true,
  },
  {
    name: 'English Chinese Mode Select',
    path: '/study/english-chinese/mode',
    element: <EnglishChineseModeSelectPage />,
    public: true,
  },
  {
    name: 'Chinese English Mode Select',
    path: '/study/chinese-english/mode',
    element: <ChineseEnglishModeSelectPage />,
    public: true,
  },
  {
    name: 'English Chinese Quiz',
    path: '/english-chinese-quiz',
    element: <EnglishChineseQuizPage />,
    public: true,
  },
  {
    name: 'Chinese English Quiz',
    path: '/chinese-english-quiz',
    element: <ChineseEnglishQuizPage />,
    public: true,
  },
  {
    name: 'Mixed Quiz',
    path: '/mixed-quiz',
    element: <MixedQuizPage />,
    public: true,
  },
  {
    name: 'Quiz Result',
    path: '/quiz-result',
    element: <QuizResultPage />,
    public: true,
  },
  {
    name: 'Read Aloud Settings',
    path: '/read-aloud-settings',
    element: <ReadAloudSettingsPage />,
    public: true,
  },
  {
    name: 'Read Aloud',
    path: '/read-aloud',
    element: <ReadAloudPage />,
    public: true,
  },
  {
    name: 'Wrong Words',
    path: '/wrong-words',
    element: <WrongWordsPage />,
    public: true,
  },
  {
    name: 'Wrong Words Mode Selection',
    path: '/wrong-words/practice/mode-selection',
    element: <WrongWordsModeSelectionPage />,
    public: true,
  },
  {
    name: 'Wrong Words Practice English Chinese Settings',
    path: '/wrong-words/practice/english-chinese/settings',
    element: <WrongWordsPracticeEnglishChineseSettingsPage />,
    public: true,
  },
  {
    name: 'Wrong Words Practice Chinese English Settings',
    path: '/wrong-words/practice/chinese-english/settings',
    element: <WrongWordsPracticeChineseEnglishSettingsPage />,
    public: true,
  },
  {
    name: 'Wrong Words Practice Mixed Settings',
    path: '/wrong-words/practice/mixed/settings',
    element: <WrongWordsPracticeMixedSettingsPage />,
    public: true,
  },
  {
    name: 'Wrong Words Practice',
    path: '/wrong-words/practice',
    element: <WrongWordsPracticePage />,
    public: true,
  },
  {
    name: 'Statistics',
    path: '/statistics',
    element: <StatisticsPage />,
    public: true,
  },
  {
    name: 'Settings',
    path: '/settings',
    element: <SettingsPage />,
    public: true,
  },
  {
    name: 'Data Management',
    path: '/data-management',
    element: <DataManagementPage />,
    public: true,
  },
];

export default routes;
