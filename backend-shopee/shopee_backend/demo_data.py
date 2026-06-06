from __future__ import annotations

from .models import Listing, ListingVersion, SellerProfile


SELLER_PROFILE = SellerProfile(
    seller_id="S-DEMO-SELLER",
    shop_name="Ranen Tech Deals",
    username="ranen.tech",
    avatar_url="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?auto=format&fit=crop&w=240&q=80",
    cover_url="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1400&q=80",
    description="Singapore-based seller for everyday electronics, lifestyle goods, and limited demo drops.",
    pickup_address="5 Science Park Drive, Singapore 118265",
    phone="+65 8123 4567",
    email="seller@example.com",
    joined="2024-03-18",
    rating=4.8,
    response_rate=98,
    followers=12840,
)


SEED_LISTINGS: dict[str, Listing] = {
    "L-BRAND-001": Listing(
        listing_id="L-BRAND-001",
        versions=[
            ListingVersion(
                listing_id="L-BRAND-001",
                version=1,
                status="approved",
                title="Wireless Earbuds Bluetooth 5.0",
                description="Good condition wireless earbuds.",
                brand=None,
                price=30,
                image_id="generic_earbuds_01",
                seller_id="S-DEMO-SELLER",
            )
        ],
    ),
    "L-SAFE-001": Listing(
        listing_id="L-SAFE-001",
        versions=[
            ListingVersion(
                listing_id="L-SAFE-001",
                version=1,
                status="approved",
                title="Uniqlo Airism Cotton T-Shirt",
                description="Lightly used. Bought from Uniqlo Singapore.",
                brand="Uniqlo",
                price=12,
                image_id="uniqlo_tshirt_clear_photo",
                seller_id="S-DEMO-SELLER",
            )
        ],
    ),
    "L-BAG-001": Listing(
        listing_id="L-BAG-001",
        versions=[
            ListingVersion(
                listing_id="L-BAG-001",
                version=1,
                status="approved",
                title="Minimal Nylon Crossbody Bag",
                description="Lightweight daily carry bag with adjustable strap.",
                brand="Everyday Co",
                price=18,
                image_id="nylon_crossbody_bag_01",
                seller_id="S-DEMO-SELLER",
            )
        ],
    ),
}


SUSPICIOUS_EDIT = {
    "title": "Apple AirPods Pro OEM 1:1 Authentic",
    "description": "Factory batch, same production line, mirror quality.",
    "brand": "Apple",
    "price": 12,
    "image_id": "airpods_branded_box_01",
    "status": "approved",
}
