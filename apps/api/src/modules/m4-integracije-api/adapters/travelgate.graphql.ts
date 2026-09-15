// M4 spec §5 — Travelgate (TravelgateX HotelX Pull Buyers) GraphQL upiti.
//
// SEARCH_QUERY/QUOTE_QUERY/BOOK_MUTATION/CANCEL_MUTATION su prepisani iz 27 stvarnih,
// uživo snimljenih poziva iz zvanične TravelgateX sertifikacije (15.9.2026) — vidi
// docs/moduli/M04-integracije-api/referentni-materijal/travelgatex-certification-samples/.
// Raniji oblik ovih upita (pre 15.9.2026) je bio IZMIŠLJEN — nikad proveren protiv
// stvarnog servera, i pokazalo se da ne odgovara stvarnoj šemi (M4 spec v1.17,
// docs/analize/33-ZAMKE-I-OBAVEZNE-PROVERE.md zamka 8.13). CONTENT_QUERY ostaje
// izuzetak: sertifikacija ne pokriva `content` operaciju, ovaj upit je i dalje
// neproveren nagađanje.

export const SEARCH_QUERY = `
query HotelXSearch($criteriaSearch: HotelCriteriaSearchInput, $settings: HotelSettingsInput, $filterSearch: HotelXFilterSearchInput) {
  hotelX {
    search(criteria: $criteriaSearch, settings: $settings, filterSearch: $filterSearch) {
      errors { code type description }
      options {
        id
        hotelCode
        boardCode
        status
        paymentType
        cancelPolicy { refundable }
        price { net currency }
      }
    }
  }
}`;

// NEPROVERENO (nema u sertifikacionim primerima) — TravelgateX `content` operacija nije
// deo Search→Quote→Book→Cancel toka koji je sertifikacija pokrila. Ostaje kako je bilo
// pre 15.9.2026, nagađanje iz opšte GraphQL/Hotel-X dokumentacije.
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
      errors { code type description }
      optionQuote {
        optionRefId
        hotelCode
        boardCode
        status
        paymentType
        cancelPolicy { refundable }
        price { net currency }
      }
    }
  }
}`;

export const BOOK_MUTATION = `
mutation HotelXBook($input: HotelBookInput!, $settings: HotelSettingsInput, $filter: HotelXFilterInput) {
  hotelX {
    book(input: $input, settings: $settings, filter: $filter) {
      errors { code type description }
      booking {
        status
        reference { bookingID }
        hotel { hotelCode boardCode }
        cancelPolicy { refundable }
      }
    }
  }
}`;

export const CANCEL_MUTATION = `
mutation HotelXCancel($input: HotelCancelInput!, $settings: HotelSettingsInput) {
  hotelX {
    cancel(input: $input, settings: $settings) {
      errors { code type description }
      cancellation {
        status
        reference { bookingID client supplier hotel }
      }
    }
  }
}`;
