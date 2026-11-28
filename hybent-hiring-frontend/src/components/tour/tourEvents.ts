/** Fired by the profile menu's "Product tour"; ProductTour listens for it. */
export const START_TOUR_EVENT = 'hb:start-product-tour'
export const startProductTour = () => window.dispatchEvent(new Event(START_TOUR_EVENT))
