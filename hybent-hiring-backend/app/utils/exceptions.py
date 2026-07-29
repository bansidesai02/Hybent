class InsufficientCreditsException(Exception):
    def __init__(self, message: str = "Your organization has exhausted its AI Credits. Please purchase additional credits or upgrade your subscription."):
        self.message = message
        super().__init__(self.message)
