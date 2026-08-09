import './App.css'
import { OperatorWorkspace } from './views/OperatorWorkspace'

/**
 * DEC-102. The application is the operator workspace: FUNCTIONAL_DESIGN §6's
 * six named views. Everything else it used to render directly is now a view
 * inside it.
 */
function App() {
  return <OperatorWorkspace />
}

export default App
