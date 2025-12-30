import { useId } from "react"
import { Container } from "../ui/container"
import { Label } from "../ui/label"
import { RadioGroup, RadioGroupItem } from "../ui/radio-group"

const Appearance = () => {
  const systemId = useId()
  const lightId = useId()
  const darkId = useId()

  return (
    <Container maxW="full">
      <h2 className="text-lg font-semibold py-4">Appearance</h2>

      <p className="text-sm text-muted-foreground mb-4">
        Dark mode is not yet implemented. This section will be available in a
        future update.
      </p>

      <RadioGroup disabled defaultValue="light">
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="system" id={systemId} />
          <Label htmlFor={systemId} className="cursor-not-allowed opacity-50">
            System
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="light" id={lightId} />
          <Label htmlFor={lightId} className="cursor-not-allowed opacity-50">
            Light Mode
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="dark" id={darkId} />
          <Label htmlFor={darkId} className="cursor-not-allowed opacity-50">
            Dark Mode
          </Label>
        </div>
      </RadioGroup>
    </Container>
  )
}

export default Appearance
