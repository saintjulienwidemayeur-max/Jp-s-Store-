// Strings for debit-card payments (Stripe-hosted). Registered on import.
import { addMessages } from './i18n.js';

addMessages('en', {
  'payment.logos_label': 'Accepted cards: Visa, Mastercard, American Express, Discover',
  'payment.secure_alt': 'Secure payment',
  'payment.secure_title': 'Secure payment.',
  'payment.secure_text': 'Pay by debit card through Stripe. Your card details never touch our site.',
  'checkout.pm.debit_card': 'Debit card', 'checkout.pm.debit_card_hint': 'Visa, Mastercard and more. You pay on Stripe’s secure page.',
  'checkout.debit_note': 'After you place the order you are sent to Stripe’s secure page to enter your card. We never see or store your card number.',
  'checkout.pay_card': 'Place order and pay by card', 'checkout.redirecting': 'Redirecting to secure payment…',
  'checkout.err_card': 'We could not start the card payment. Your order was saved; open it to try again.',
  'checkout.recommended': 'Recommended',
  'demo.badge': 'DEMO MODE', 'demo.title': 'Demo payment',
  'demo.text': 'Card payments are not connected yet, so this is a demo screen. No card is charged and no card details are asked for.',
  'demo.total': 'Amount to pay', 'demo.simulate': 'Simulate successful payment (demo)', 'demo.cancel': 'Cancel payment (demo)',
  'order.paid_ok': 'Payment received', 'order.paid_ok_sub': 'Thank you! Your card payment was successful.',
  'order.paid_checking': 'Confirming your payment…', 'order.paid_checking_sub': 'This usually takes a few seconds.',
  'order.pay_cancelled': 'Payment cancelled', 'order.pay_cancelled_sub': 'Your order is saved but not paid yet. You can try again.',
  'order.pay_unpaid': 'Payment not completed yet', 'order.try_again': 'Try again', 'order.pay_now': 'Pay now by card',
  'order.status.paid_badge': 'Paid', 'order.pay_demo_tag': 'Demo payment',
  'order.pay.debit_card': 'Pay {total} by debit card on Stripe’s secure page. Your card details are never shared with us.',
  'order.pay_err': 'Could not open the payment page. Please try again.'
});
addMessages('fr', {
  'payment.logos_label': 'Cartes acceptées : Visa, Mastercard, American Express, Discover',
  'payment.secure_alt': 'Paiement sécurisé',
  'payment.secure_title': 'Paiement sécurisé.',
  'payment.secure_text': 'Payez par carte de débit via Stripe. Vos données de carte ne passent jamais par notre site.',
  'checkout.pm.debit_card': 'Carte de débit', 'checkout.pm.debit_card_hint': 'Visa, Mastercard et plus. Vous payez sur la page sécurisée de Stripe.',
  'checkout.debit_note': 'Après avoir passé la commande, vous êtes redirigé vers la page sécurisée de Stripe pour saisir votre carte. Nous ne voyons ni ne conservons jamais votre numéro de carte.',
  'checkout.pay_card': 'Commander et payer par carte', 'checkout.redirecting': 'Redirection vers le paiement sécurisé…',
  'checkout.err_card': 'Impossible de lancer le paiement par carte. Votre commande est enregistrée ; ouvrez-la pour réessayer.',
  'checkout.recommended': 'Recommandé',
  'demo.badge': 'MODE DÉMO', 'demo.title': 'Paiement de démonstration',
  'demo.text': 'Le paiement par carte n’est pas encore connecté : il s’agit d’un écran de démonstration. Aucune carte n’est débitée et aucune donnée de carte n’est demandée.',
  'demo.total': 'Montant à payer', 'demo.simulate': 'Simuler un paiement réussi (démo)', 'demo.cancel': 'Annuler le paiement (démo)',
  'order.paid_ok': 'Paiement reçu', 'order.paid_ok_sub': 'Merci ! Votre paiement par carte a réussi.',
  'order.paid_checking': 'Confirmation de votre paiement…', 'order.paid_checking_sub': 'Cela prend généralement quelques secondes.',
  'order.pay_cancelled': 'Paiement annulé', 'order.pay_cancelled_sub': 'Votre commande est enregistrée mais pas encore payée. Vous pouvez réessayer.',
  'order.pay_unpaid': 'Paiement non finalisé', 'order.try_again': 'Réessayer', 'order.pay_now': 'Payer maintenant par carte',
  'order.status.paid_badge': 'Payée', 'order.pay_demo_tag': 'Paiement démo',
  'order.pay.debit_card': 'Payez {total} par carte de débit sur la page sécurisée de Stripe. Vos données de carte ne nous sont jamais transmises.',
  'order.pay_err': 'Impossible d’ouvrir la page de paiement. Veuillez réessayer.'
});
addMessages('ht', {
  'payment.logos_label': 'Kat nou aksepte: Visa, Mastercard, American Express, Discover',
  'payment.secure_alt': 'Peman an sekirite',
  'payment.secure_title': 'Peman an sekirite.',
  'payment.secure_text': 'Peye ak kat debi atravè Stripe. Enfòmasyon kat ou pa janm pase sou sit nou an.',
  'checkout.pm.debit_card': 'Kat debi', 'checkout.pm.debit_card_hint': 'Visa, Mastercard ak lòt. Ou peye sou paj sekirite Stripe a.',
  'checkout.debit_note': 'Apre ou fin pase kòmand lan, n ap voye ou sou paj sekirite Stripe pou ou antre kat ou. Nou pa janm wè ni kenbe nimewo kat ou.',
  'checkout.pay_card': 'Pase kòmand epi peye ak kat', 'checkout.redirecting': 'N ap voye w sou peman an sekirite…',
  'checkout.err_card': 'Nou pa t ka kòmanse peman ak kat la. Kòmand ou anrejistre; louvri l pou ou eseye ankò.',
  'checkout.recommended': 'Rekòmande',
  'demo.badge': 'MOD DEMO', 'demo.title': 'Peman demo',
  'demo.text': 'Peman ak kat poko konekte, kidonk sa a se yon paj demo. Pa gen kat ki debite e nou pa mande okenn enfòmasyon kat.',
  'demo.total': 'Montan pou peye', 'demo.simulate': 'Simile yon peman ki reyisi (demo)', 'demo.cancel': 'Anile peman an (demo)',
  'order.paid_ok': 'Peman resevwa', 'order.paid_ok_sub': 'Mèsi! Peman kat ou a pase.',
  'order.paid_checking': 'N ap konfime peman ou…', 'order.paid_checking_sub': 'Sa pran kèk segonn anjeneral.',
  'order.pay_cancelled': 'Peman anile', 'order.pay_cancelled_sub': 'Kòmand ou anrejistre men li poko peye. Ou ka eseye ankò.',
  'order.pay_unpaid': 'Peman an poko fini', 'order.try_again': 'Eseye ankò', 'order.pay_now': 'Peye kounye a ak kat',
  'order.status.paid_badge': 'Peye', 'order.pay_demo_tag': 'Peman demo',
  'order.pay.debit_card': 'Peye {total} ak kat debi sou paj sekirite Stripe a. Nou pa janm resevwa enfòmasyon kat ou.',
  'order.pay_err': 'Nou pa t ka louvri paj peman an. Tanpri eseye ankò.'
});

// Multi-step checkout + overrides of copy that used to say "card payment coming soon"
// (these override keys from i18n.js / i18n.commerce.js on every page that imports this module).
addMessages('en', {
  'checkout.subtitle': 'Shipping is included. Pay securely by debit card.',
  'home.vp.3.d': 'Pay by debit card (Visa, Mastercard) through Stripe, or MonCash and Zelle. We never see your card details.',
  'info.faq.a3': 'Debit card (Visa, Mastercard and more) through Stripe’s secure page, plus MonCash, Zelle and cash on delivery. We never collect or store card details on this site.',
  'checkout.steps_label': 'Checkout steps', 'checkout.step.contact': 'Contact', 'checkout.step.address': 'Delivery', 'checkout.step.payment': 'Payment', 'checkout.step.review': 'Review',
  'checkout.step_of': 'Step {n} of {total}: {name}',
  'checkout.h.contact': 'Your contact details', 'checkout.h.address': 'Delivery address', 'checkout.h.payment': 'Payment method', 'checkout.h.review': 'Review and place your order',
  'checkout.next': 'Continue', 'checkout.back': 'Back', 'checkout.edit': 'Edit', 'checkout.show_summary': 'Order summary',
  'checkout.ship_banner': 'Shipping included: no extra delivery fee.', 'checkout.review_hint': 'Check everything below, then place your order.',
  'checkout.items': 'Items', 'checkout.coupon_label': 'Coupon'
});
addMessages('fr', {
  'checkout.subtitle': 'Livraison incluse. Payez en toute sécurité par carte de débit.',
  'home.vp.3.d': 'Payez par carte de débit (Visa, Mastercard) via Stripe, ou par MonCash et Zelle. Nous ne voyons jamais vos données de carte.',
  'info.faq.a3': 'Carte de débit (Visa, Mastercard et plus) via la page sécurisée de Stripe, ainsi que MonCash, Zelle et paiement à la livraison. Nous ne collectons ni ne conservons jamais de données de carte sur ce site.',
  'checkout.steps_label': 'Étapes de la commande', 'checkout.step.contact': 'Contact', 'checkout.step.address': 'Livraison', 'checkout.step.payment': 'Paiement', 'checkout.step.review': 'Récapitulatif',
  'checkout.step_of': 'Étape {n} sur {total} : {name}',
  'checkout.h.contact': 'Vos coordonnées', 'checkout.h.address': 'Adresse de livraison', 'checkout.h.payment': 'Mode de paiement', 'checkout.h.review': 'Vérifiez et passez votre commande',
  'checkout.next': 'Continuer', 'checkout.back': 'Retour', 'checkout.edit': 'Modifier', 'checkout.show_summary': 'Récapitulatif de la commande',
  'checkout.ship_banner': 'Livraison incluse : aucun frais de livraison supplémentaire.', 'checkout.review_hint': 'Vérifiez tout ci-dessous, puis passez votre commande.',
  'checkout.items': 'Articles', 'checkout.coupon_label': 'Code promo'
});
addMessages('ht', {
  'checkout.subtitle': 'Livrezon enkli. Peye an sekirite ak kat debi.',
  'home.vp.3.d': 'Peye ak kat debi (Visa, Mastercard) atravè Stripe, oswa ak MonCash ak Zelle. Nou pa janm wè enfòmasyon kat ou.',
  'info.faq.a3': 'Kat debi (Visa, Mastercard ak lòt) sou paj sekirite Stripe a, ansanm ak MonCash, Zelle ak peman lè w resevwa. Nou pa janm kolekte ni kenbe enfòmasyon kat sou sit sa a.',
  'checkout.steps_label': 'Etap kòmand lan', 'checkout.step.contact': 'Kontak', 'checkout.step.address': 'Livrezon', 'checkout.step.payment': 'Peman', 'checkout.step.review': 'Revizyon',
  'checkout.step_of': 'Etap {n} sou {total}: {name}',
  'checkout.h.contact': 'Enfòmasyon kontak ou', 'checkout.h.address': 'Adrès livrezon', 'checkout.h.payment': 'Metòd peman', 'checkout.h.review': 'Verifye epi pase kòmand ou',
  'checkout.next': 'Kontinye', 'checkout.back': 'Retounen', 'checkout.edit': 'Modifye', 'checkout.show_summary': 'Rezime kòmand lan',
  'checkout.ship_banner': 'Livrezon enkli: pa gen frè livrezon anplis.', 'checkout.review_hint': 'Verifye tout bagay anba a, apresa pase kòmand ou.',
  'checkout.items': 'Atik', 'checkout.coupon_label': 'Kòd pwomo'
});
