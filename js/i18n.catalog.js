// Strings for Addendum 3: admin Categories tab, product category/featured fields, category filter.
import { addMessages } from './i18n.js';

const en = {
  'admin.tab_categories': 'Categories',
  'admin.cat.title': 'Categories', 'admin.cat.new': 'New category', 'admin.cat.edit': 'Edit category',
  'admin.cat.list': 'Category list', 'admin.cat.empty': 'No categories yet. Create your first one.',
  'admin.cat.name': 'Name', 'admin.cat.slug': 'Slug', 'admin.cat.desc': 'Description',
  'admin.cat.image': 'Category image', 'admin.cat.image_hint': 'JPEG, PNG or WebP, up to 8 MB. It is resized automatically.',
  'admin.cat.image_choose': 'Choose image', 'admin.cat.image_remove': 'Remove image', 'admin.cat.image_preview': 'Image preview',
  'admin.cat.featured': 'Featured on the home page', 'admin.cat.active': 'Active (visible in the store)',
  'admin.cat.is_featured': 'Featured', 'admin.cat.products_n': '{n} product(s)',
  'admin.cat.up': 'Move {name} up', 'admin.cat.down': 'Move {name} down', 'admin.cat.position': 'Position {i} of {n}',
  'admin.cat.moved': 'Order saved', 'admin.cat.saved': 'Category saved', 'admin.cat.deleted': 'Category deleted',
  'admin.cat.delete_title': 'Delete “{name}”?', 'admin.cat.delete_plain': 'This category has no products. This cannot be undone.',
  'admin.cat.delete_reassign': '{n} product(s) use this category. Choose where they should go before deleting.',
  'admin.cat.reassign_to': 'Move the products to', 'admin.cat.delete_confirm': 'Delete category', 'admin.cat.no_target': 'There is no other category to move the products to. Create one first.',
  'admin.cat.err_name': 'Please enter a name of at least 2 characters.', 'admin.cat.err_image': 'This image cannot be used: {why}',
  'admin.cat.err_load': 'Categories could not be loaded.',
  'admin.p_featured': 'Featured product', 'admin.featured': 'Featured',
  'admin.filter_category': 'Filter by category', 'admin.all_categories': 'All categories', 'admin.no_category': 'No category',
  'admin.no_products_filter': 'No products in this category.',
};

const fr = {
  'admin.tab_categories': 'Catégories',
  'admin.cat.title': 'Catégories', 'admin.cat.new': 'Nouvelle catégorie', 'admin.cat.edit': 'Modifier la catégorie',
  'admin.cat.list': 'Liste des catégories', 'admin.cat.empty': 'Aucune catégorie pour le moment. Créez la première.',
  'admin.cat.name': 'Nom', 'admin.cat.slug': 'Slug', 'admin.cat.desc': 'Description',
  'admin.cat.image': 'Image de la catégorie', 'admin.cat.image_hint': 'JPEG, PNG ou WebP, 8 Mo maximum. Elle est redimensionnée automatiquement.',
  'admin.cat.image_choose': 'Choisir une image', 'admin.cat.image_remove': 'Retirer l’image', 'admin.cat.image_preview': 'Aperçu de l’image',
  'admin.cat.featured': 'Mise en avant sur l’accueil', 'admin.cat.active': 'Active (visible dans la boutique)',
  'admin.cat.is_featured': 'En vedette', 'admin.cat.products_n': '{n} produit(s)',
  'admin.cat.up': 'Monter {name}', 'admin.cat.down': 'Descendre {name}', 'admin.cat.position': 'Position {i} sur {n}',
  'admin.cat.moved': 'Ordre enregistré', 'admin.cat.saved': 'Catégorie enregistrée', 'admin.cat.deleted': 'Catégorie supprimée',
  'admin.cat.delete_title': 'Supprimer « {name} » ?', 'admin.cat.delete_plain': 'Cette catégorie ne contient aucun produit. Cette action est irréversible.',
  'admin.cat.delete_reassign': '{n} produit(s) utilisent cette catégorie. Choisissez où les déplacer avant de la supprimer.',
  'admin.cat.reassign_to': 'Déplacer les produits vers', 'admin.cat.delete_confirm': 'Supprimer la catégorie', 'admin.cat.no_target': 'Il n’y a pas d’autre catégorie où déplacer les produits. Créez-en une d’abord.',
  'admin.cat.err_name': 'Veuillez saisir un nom d’au moins 2 caractères.', 'admin.cat.err_image': 'Cette image ne peut pas être utilisée : {why}',
  'admin.cat.err_load': 'Impossible de charger les catégories.',
  'admin.p_featured': 'Produit en vedette', 'admin.featured': 'En vedette',
  'admin.filter_category': 'Filtrer par catégorie', 'admin.all_categories': 'Toutes les catégories', 'admin.no_category': 'Sans catégorie',
  'admin.no_products_filter': 'Aucun produit dans cette catégorie.',
};

const ht = {
  'admin.tab_categories': 'Kategori',
  'admin.cat.title': 'Kategori', 'admin.cat.new': 'Nouvo kategori', 'admin.cat.edit': 'Modifye kategori a',
  'admin.cat.list': 'Lis kategori yo', 'admin.cat.empty': 'Poko gen kategori. Kreye premye a.',
  'admin.cat.name': 'Non', 'admin.cat.slug': 'Slug', 'admin.cat.desc': 'Deskripsyon',
  'admin.cat.image': 'Imaj kategori a', 'admin.cat.image_hint': 'JPEG, PNG oswa WebP, jiska 8 Mo. Nou ajiste gwosè l otomatikman.',
  'admin.cat.image_choose': 'Chwazi yon imaj', 'admin.cat.image_remove': 'Retire imaj la', 'admin.cat.image_preview': 'Apèsi imaj la',
  'admin.cat.featured': 'Mete l devan sou paj dakèy', 'admin.cat.active': 'Aktif (vizib nan bòutik la)',
  'admin.cat.is_featured': 'An vedèt', 'admin.cat.products_n': '{n} pwodwi',
  'admin.cat.up': 'Monte {name}', 'admin.cat.down': 'Desann {name}', 'admin.cat.position': 'Plas {i} sou {n}',
  'admin.cat.moved': 'Nou anrejistre òdre a', 'admin.cat.saved': 'Nou anrejistre kategori a', 'admin.cat.deleted': 'Nou efase kategori a',
  'admin.cat.delete_title': 'Efase « {name} » ?', 'admin.cat.delete_plain': 'Kategori sa a pa gen pwodwi ladan l. Ou pa ka defèt aksyon sa a.',
  'admin.cat.delete_reassign': '{n} pwodwi nan kategori sa a. Chwazi kote pou nou mete yo anvan nou efase l.',
  'admin.cat.reassign_to': 'Mete pwodwi yo nan', 'admin.cat.delete_confirm': 'Efase kategori a', 'admin.cat.no_target': 'Pa gen lòt kategori pou mete pwodwi yo. Kreye youn anvan.',
  'admin.cat.err_name': 'Tanpri mete yon non ki gen omwen 2 lèt.', 'admin.cat.err_image': 'Nou pa ka itilize imaj sa a : {why}',
  'admin.cat.err_load': 'Nou pa rive chaje kategori yo.',
  'admin.p_featured': 'Pwodwi an vedèt', 'admin.featured': 'An vedèt',
  'admin.filter_category': 'Filtre pa kategori', 'admin.all_categories': 'Tout kategori', 'admin.no_category': 'San kategori',
  'admin.no_products_filter': 'Pa gen pwodwi nan kategori sa a.',
};

addMessages('en', en);
addMessages('fr', fr);
addMessages('ht', ht);
