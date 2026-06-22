---
title: "Doctrine symphony"
topic: "development"
level: "beginner"
tags: ["doctrine", "symphony", "databases", "and", "the"]
source_type: "web_saved"
source_id: "https://symfony2-document.readthedocs.io/en/latest/book/doctrine.html"
confidence: "medium"
status: "draft"
updated: "2026-06-19"
---

# Doctrine symphony

### Configuration de la base de données

La configuration de la base de données est généralement effectuée dans le fichier `app/config/parameters.yml` :

```yaml
parameters:
    database_driver: pdo_mysql
    database_host: localhost
    database_name: test_project
    database_user: root
    database_password: password
```

La configuration Doctrine est définie dans le fichier de configuration principal :

```yaml
doctrine:
    dbal:
        driver: %database_driver%
        host: %database_host%
        dbname: %database_name%
        user: %database_user%
        password: %database_password%
```

Pour créer la base de données, exécutez la commande suivante :

```bash
php app/console doctrine:database:create
```

### Création d'une classe d'entité

Créez une classe `Product` dans le répertoire `Entity` de votre bundle :

```php
// src/Acme/StoreBundle/Entity/Product.php
namespace Acme\StoreBundle\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 * @ORM\Table(name="product")
 */
class Product
{
    /**
     * @ORM\Id
     * @ORM\Column(type="integer")
     * @ORM\GeneratedValue(strategy="AUTO")
     */
    protected $id;

    /**
     * @ORM\Column(type="string", length=100)
     */
    protected $name;

    /**
     * @ORM\Column(type="decimal", scale=2)
     */
    protected $price;

    /**
     * @ORM\Column(type="text")
     */
    protected $description;
}
```

### Génération des getters et setters

Pour générer les méthodes `getter` et `setter`, exécutez la commande suivante :

```bash
php app/console doctrine:generate:entities Acme/StoreBundle/Entity/Product
```

### Mise à jour du schéma de la base de données

Pour créer les tables de la base de données en fonction des entités définies, exécutez :

```bash
php app/console doctrine:schema:update --force
```

### Persistance d'objets dans la base de données

Pour persister un objet dans la base de données, utilisez le code suivant dans un contrôleur :

```php
use Acme\StoreBundle\Entity\Product;
use Symfony\Component\HttpFoundation\Response;

public function createAction()
{
    $product = new Product();
    $product->setName('A Foo Bar');
    $product->setPrice('19.99');
    $product->setDescription('Lorem ipsum dolor');

    $em = $this->getDoctrine()->getEntityManager();
    $em->persist($product);
    $em->flush();

    return new Response('Created product id ' . $product->getId());
}
```

### Récupération d'objets depuis la base de données

Pour récupérer un objet depuis la base de données, utilisez le code suivant :

```php
public function showAction($id)
{
    $product = $this->getDoctrine()
        ->getRepository('AcmeStoreBundle:Product')
        ->find($id);

    if (!$product) {
        throw $this->createNotFoundException('No product found for id ' . $id);
    }

    // do something, like pass the $product object into a template
}

## Source

- [Databases and Doctrine (“The Model”) &mdash; Symfony2 Docs 2 documentation](https://symfony2-document.readthedocs.io/en/latest/book/doctrine.html)
