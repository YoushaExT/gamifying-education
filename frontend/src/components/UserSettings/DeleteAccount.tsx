import { Container } from "../ui/container"
import DeleteConfirmation from "./DeleteConfirmation"

const DeleteAccount = () => {
  return (
    <Container maxW="full">
      <h2 className="text-lg font-semibold py-4">Delete Account</h2>
      <p className="text-sm text-muted-foreground">
        Permanently delete your data and everything associated with your
        account.
      </p>
      <DeleteConfirmation />
    </Container>
  )
}

export default DeleteAccount
