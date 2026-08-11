// M4 spec §5 — Travelgate Hotel-X GraphQL upiti. Sam kod se ne prenosi automatski iz
// PrimeTravel (CLAUDE.md) — ovo su upiti rekonstruisani po istom, javno dokumentovanom
// Travelgate Hotel-X ugovoru koji je tamo već radio uživo, korišćeni samo kao referenca
// za oblik poziva (isto obrazloženje kao Solvex WSDL detalji u M3 spec §5a).

export const SEARCH_QUERY = `
query HotelXSearch($criteriaSearch: HotelCriteriaSearchInput!, $settings: HotelSettingsInput) {
  hotelX {
    search(criteria: $criteriaSearch, settings: $settings) {
      options {
        id
        hotelCode
        hotelName
        boardName
        status
        totalStayPrice { currency net gross }
      }
      errors { code type description }
    }
  }
}`;

export const CONTENT_QUERY = `
query HotelXContent($criteriaContent: HotelCriteriaContentInput!) {
  hotelX {
    content(criteria: $criteriaContent) {
      hotels {
        hotelCode
        hotelName
        description
        address { city country }
        images { url }
        category { code }
      }
      errors { code type description }
    }
  }
}`;

export const QUOTE_QUERY = `
query HotelXQuote($criteriaQuote: HotelCriteriaQuoteInput!, $settings: HotelSettingsInput) {
  hotelX {
    quote(criteria: $criteriaQuote, settings: $settings) {
      optionQuote {
        optionRefId
        status
        price { currency net gross }
        cancelPolicy {
          refundable
          cancelPenalties { hoursBefore penaltyType currency value deadline }
        }
      }
      errors { code type description }
    }
  }
}`;

export const BOOK_MUTATION = `
mutation HotelXBook($bookInput: HotelBookInput!, $settings: HotelSettingsInput) {
  hotelX {
    book(input: $bookInput, settings: $settings) {
      booking {
        id
        supplierReference
        status
        price { currency net gross }
      }
      errors { code type description }
    }
  }
}`;

export const CANCEL_MUTATION = `
mutation HotelXCancel($cancelInput: HotelCancelInput!) {
  hotelX {
    cancel(input: $cancelInput) {
      booking { id status }
      errors { code type description }
    }
  }
}`;
