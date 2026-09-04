import GlobeViewer from './components/GlobeViewer.tsx'
import { LanguageProvider } from './i18n/lang.tsx'
import './App.css'

function App() {
  return (
    <div className="app">
      <LanguageProvider>
        <GlobeViewer />
      </LanguageProvider>
    </div>
  )
}

export default App
