import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  Camera,
  ChevronRight,
  CircleDollarSign,
  Edit3,
  Eye,
  Home,
  Image,
  LayoutDashboard,
  Menu,
  Package,
  PackagePlus,
  Search,
  Settings,
  ShoppingBag,
  Store,
  Upload,
  UserRound,
} from "lucide-react";
import "./styles.css";

const API_BASE = import.meta.env.VITE_SHOPEE_API_BASE ?? "http://127.0.0.1:8000";

type ListingStatus = "draft" | "approved" | "suppressed";
type Page = "dashboard" | "listings" | "detail" | "create" | "edit" | "profile" | "profile-edit";

type ListingVersion = {
  listing_id: string;
  version: number;
  status: ListingStatus;
  title: string;
  description: string;
  brand: string | null;
  price: number;
  image_id: string;
  seller_id: string;
};

type Listing = {
  listing_id: string;
  versions: ListingVersion[];
};

type SellerProfile = {
  seller_id: string;
  shop_name: string;
  username: string;
  avatar_url: string;
  cover_url: string;
  description: string;
  pickup_address: string;
  phone: string;
  email: string;
  joined: string;
  rating: number;
  response_rate: number;
  followers: number;
};

type MutationResponse = {
  listing: Listing;
  current_version: ListingVersion;
  investigation_triggered: boolean;
  investigation_id: string;
  review_type: string;
};

type ListingForm = {
  title: string;
  description: string;
  brand: string;
  price: number;
  image_id: string;
  status: ListingStatus;
};

const newListingForm: ListingForm = {
  title: "",
  description: "",
  brand: "",
  price: 0,
  image_id: "",
  status: "approved",
};

const categoryTiles = ["Electronics", "Men Bags", "Women Clothes", "Home Living", "Beauty", "Sports"];

function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [listings, setListings] = useState<Listing[]>([]);
  const [profile, setProfile] = useState<SellerProfile | null>(null);
  const [selectedId, setSelectedId] = useState("L-BRAND-001");
  const [listingForm, setListingForm] = useState<ListingForm>(newListingForm);
  const [profileForm, setProfileForm] = useState<Partial<SellerProfile>>({});
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedListing = useMemo(
    () => listings.find((listing) => listing.listing_id === selectedId) ?? listings[0] ?? null,
    [listings, selectedId],
  );
  const currentListing = selectedListing ? latest(selectedListing) : null;
  const visibleListings = listings.filter((listing) => {
    const current = latest(listing);
    const haystack = `${current.title} ${current.brand ?? ""} ${listing.listing_id}`.toLowerCase();
    return haystack.includes(query.toLowerCase());
  });
  const liveCount = listings.filter((listing) => latest(listing).status === "approved").length;
  const suppressedCount = listings.filter((listing) => latest(listing).status === "suppressed").length;
  const inventoryValue = listings.reduce((sum, listing) => sum + latest(listing).price, 0);

  useEffect(() => {
    void loadData();
  }, []);

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(null), 2400);
  }

  async function loadData() {
    setError(null);
    const [listingResponse, profileResponse] = await Promise.all([
      fetch(`${API_BASE}/listings`),
      fetch(`${API_BASE}/seller/profile`),
    ]);
    if (!listingResponse.ok || !profileResponse.ok) {
      setError("Could not connect to backend-shopee.");
      return;
    }
    const listingData = (await listingResponse.json()) as Listing[];
    const profileData = (await profileResponse.json()) as SellerProfile;
    setListings(listingData);
    setProfile(profileData);
    setProfileForm(profileData);
    if (listingData[0] && !listingData.some((listing) => listing.listing_id === selectedId)) {
      setSelectedId(listingData[0].listing_id);
    }
  }

  function openCreate() {
    setListingForm(newListingForm);
    setPage("create");
  }

  function openEdit(listing: Listing) {
    const current = latest(listing);
    setSelectedId(listing.listing_id);
    setListingForm({
      title: current.title,
      description: current.description,
      brand: current.brand ?? "",
      price: current.price,
      image_id: current.image_id,
      status: current.status,
    });
    setPage("edit");
  }

  async function submitListing() {
    const payload = {
      title: listingForm.title || "Untitled Product",
      description: listingForm.description || "Seller has not added a description yet.",
      brand: listingForm.brand || null,
      price: Number(listingForm.price || 0),
      image_id: listingForm.image_id || "new_product_image_01",
      seller_id: profile?.seller_id ?? "S-DEMO-SELLER",
      status: listingForm.status,
    };
    const isEdit = page === "edit" && selectedListing;
    const response = await fetch(
      isEdit ? `${API_BASE}/listings/${selectedListing.listing_id}` : `${API_BASE}/listings`,
      {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    if (!response.ok) {
      setError("Could not save listing.");
      return;
    }
    const result = (await response.json()) as MutationResponse;
    setListings((current) => {
      const exists = current.some((listing) => listing.listing_id === result.listing.listing_id);
      return exists
        ? current.map((listing) => (listing.listing_id === result.listing.listing_id ? result.listing : listing))
        : [result.listing, ...current];
    });
    setSelectedId(result.listing.listing_id);
    setPage("detail");
    showToast("Listing saved. Shopee moderation checks started automatically.");
  }

  async function saveProfile() {
    const response = await fetch(`${API_BASE}/seller/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(profileForm),
    });
    if (!response.ok) {
      setError("Could not update shop profile.");
      return;
    }
    const updated = (await response.json()) as SellerProfile;
    setProfile(updated);
    setProfileForm(updated);
    setPage("profile");
    showToast("Shop profile updated.");
  }

  return (
    <main className="seller-center">
      <aside className="seller-sidebar">
        <button className="mobile-menu" aria-label="Open navigation">
          <Menu size={20} />
        </button>
        <div className="seller-logo" onClick={() => setPage("dashboard")}>
          <ShoppingBag size={26} />
          <span>Shopee Seller Centre</span>
        </div>
        <nav>
          <NavButton active={page === "dashboard"} icon={<LayoutDashboard size={18} />} label="Home" onClick={() => setPage("dashboard")} />
          <NavButton active={page === "listings" || page === "detail"} icon={<Package size={18} />} label="My Products" onClick={() => setPage("listings")} />
          <NavButton active={page === "create"} icon={<PackagePlus size={18} />} label="Add New Product" onClick={openCreate} />
          <NavButton active={page === "profile" || page === "profile-edit"} icon={<Store size={18} />} label="Shop Profile" onClick={() => setPage("profile")} />
          <NavButton active={false} icon={<Settings size={18} />} label="Shop Settings" onClick={() => setPage("profile-edit")} />
        </nav>
      </aside>

      <section className="seller-main">
        <header className="seller-topbar">
          <div className="search-box">
            <Search size={18} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products by name, brand, or SKU" />
          </div>
          <button className="icon-button" aria-label="Notifications">
            <Bell size={20} />
          </button>
          <button className="seller-chip" onClick={() => setPage("profile")}>
            <img src={profile?.avatar_url} alt="" />
            <span>{profile?.shop_name ?? "Seller"}</span>
          </button>
        </header>

        {toast && <div className="toast">{toast}</div>}
        {error && <div className="error-banner">{error}</div>}

        {page === "dashboard" && (
          <Dashboard
            profile={profile}
            liveCount={liveCount}
            suppressedCount={suppressedCount}
            inventoryValue={inventoryValue}
            listings={listings}
            onCreate={openCreate}
            onOpenListings={() => setPage("listings")}
            onOpenProfile={() => setPage("profile")}
          />
        )}

        {page === "listings" && (
          <ListingsPage
            listings={visibleListings}
            onCreate={openCreate}
            onOpen={(listing) => {
              setSelectedId(listing.listing_id);
              setPage("detail");
            }}
            onEdit={openEdit}
          />
        )}

        {page === "detail" && selectedListing && (
          <ListingDetail listing={selectedListing} onBack={() => setPage("listings")} onEdit={() => openEdit(selectedListing)} />
        )}

        {(page === "create" || page === "edit") && (
          <ListingFormPage
            mode={page}
            form={listingForm}
            setForm={setListingForm}
            onCancel={() => (page === "edit" ? setPage("detail") : setPage("listings"))}
            onSubmit={() => void submitListing()}
          />
        )}

        {page === "profile" && profile && (
          <ProfilePage profile={profile} listings={listings} onEdit={() => setPage("profile-edit")} />
        )}

        {page === "profile-edit" && profile && (
          <ProfileEditPage
            form={profileForm}
            setForm={setProfileForm}
            onCancel={() => setPage("profile")}
            onSubmit={() => void saveProfile()}
          />
        )}
      </section>
    </main>
  );
}

function NavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button className={active ? "nav-item active" : "nav-item"} onClick={onClick}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function Dashboard({
  profile,
  liveCount,
  suppressedCount,
  inventoryValue,
  listings,
  onCreate,
  onOpenListings,
  onOpenProfile,
}: {
  profile: SellerProfile | null;
  liveCount: number;
  suppressedCount: number;
  inventoryValue: number;
  listings: Listing[];
  onCreate: () => void;
  onOpenListings: () => void;
  onOpenProfile: () => void;
}) {
  return (
    <div className="page-stack">
      <section className="hero-shop">
        <img src={profile?.cover_url} alt="" />
        <div className="hero-overlay">
          <img className="hero-avatar" src={profile?.avatar_url} alt="" />
          <div>
            <p>Welcome back</p>
            <h1>{profile?.shop_name ?? "Your Shop"}</h1>
            <span>{profile?.followers.toLocaleString() ?? 0} followers · {profile?.rating ?? 0} shop rating</span>
          </div>
        </div>
      </section>

      <section className="quick-actions">
        <ActionTile icon={<PackagePlus />} title="Add New Product" description="Create a listing for your shop." onClick={onCreate} />
        <ActionTile icon={<Package />} title="Manage Products" description="View and edit active listings." onClick={onOpenListings} />
        <ActionTile icon={<UserRound />} title="Shop Profile" description="Update public seller details." onClick={onOpenProfile} />
      </section>

      <section className="metric-grid">
        <Metric title="Live Products" value={liveCount.toString()} icon={<Package />} />
        <Metric title="Suppressed" value={suppressedCount.toString()} icon={<Eye />} />
        <Metric title="Inventory Value" value={`$${inventoryValue.toFixed(2)}`} icon={<CircleDollarSign />} />
        <Metric title="Response Rate" value={`${profile?.response_rate ?? 0}%`} icon={<Bell />} />
      </section>

      <section className="market-band">
        <div className="section-heading">
          <h2>Seller Centre shortcuts</h2>
          <p>Common Shopee product categories for quick listing setup.</p>
        </div>
        <div className="category-strip">
          {categoryTiles.map((category) => (
            <button key={category}>{category}</button>
          ))}
        </div>
      </section>

      <section className="products-card">
        <div className="section-heading horizontal">
          <div>
            <h2>Recent Products</h2>
            <p>{listings.length} products in your shop</p>
          </div>
          <button className="text-button" onClick={onOpenListings}>View all <ChevronRight size={16} /></button>
        </div>
        <ProductTable listings={listings.slice(0, 4)} onOpen={() => {}} onEdit={() => {}} compact />
      </section>
    </div>
  );
}

function ListingsPage({
  listings,
  onCreate,
  onOpen,
  onEdit,
}: {
  listings: Listing[];
  onCreate: () => void;
  onOpen: (listing: Listing) => void;
  onEdit: (listing: Listing) => void;
}) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="crumb">Seller Centre / Product</p>
          <h1>My Products</h1>
        </div>
        <button className="primary-button" onClick={onCreate}><PackagePlus size={18} /> Add New Product</button>
      </div>
      <section className="products-card">
        <div className="tabs">
          <button className="active">All</button>
          <button>Live</button>
          <button>Draft</button>
          <button>Violation</button>
        </div>
        <ProductTable listings={listings} onOpen={onOpen} onEdit={onEdit} />
      </section>
    </div>
  );
}

function ProductTable({
  listings,
  onOpen,
  onEdit,
  compact = false,
}: {
  listings: Listing[];
  onOpen: (listing: Listing) => void;
  onEdit: (listing: Listing) => void;
  compact?: boolean;
}) {
  return (
    <div className="product-table">
      <div className="table-head">
        <span>Product</span>
        <span>Price</span>
        <span>Status</span>
        <span>Stock</span>
        <span>Actions</span>
      </div>
      {listings.map((listing) => {
        const current = latest(listing);
        return (
          <div className="table-row" key={listing.listing_id}>
            <button className="product-cell" onClick={() => onOpen(listing)}>
              <ProductImage imageId={current.image_id} />
              <span>
                <strong>{current.title}</strong>
                <small>{listing.listing_id} · {current.brand || "No brand"}</small>
              </span>
            </button>
            <span>${current.price.toFixed(2)}</span>
            <StatusPill status={current.status} />
            <span>{compact ? "—" : "128"}</span>
            <span className="row-actions">
              <button onClick={() => onOpen(listing)}>Details</button>
              <button onClick={() => onEdit(listing)}>Edit</button>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ListingDetail({ listing, onBack, onEdit }: { listing: Listing; onBack: () => void; onEdit: () => void }) {
  const current = latest(listing);
  return (
    <div className="page-stack">
      <button className="back-button" onClick={onBack}>My Products / {listing.listing_id}</button>
      <section className="detail-layout">
        <div className="detail-gallery">
          <ProductImage imageId={current.image_id} large />
          <div className="thumbnail-row">
            <ProductImage imageId={current.image_id} />
            <ProductImage imageId={`${current.image_id}_side`} />
            <ProductImage imageId={`${current.image_id}_box`} />
          </div>
        </div>
        <div className="detail-info">
          <div className="detail-top">
            <StatusPill status={current.status} />
            <button className="primary-button" onClick={onEdit}><Edit3 size={17} /> Edit Product</button>
          </div>
          <h1>{current.title}</h1>
          <p className="detail-price">${current.price.toFixed(2)}</p>
          <dl className="detail-specs">
            <div><dt>Brand</dt><dd>{current.brand || "No brand"}</dd></div>
            <div><dt>SKU</dt><dd>{listing.listing_id}</dd></div>
            <div><dt>Image ID</dt><dd>{current.image_id}</dd></div>
            <div><dt>Seller ID</dt><dd>{current.seller_id}</dd></div>
          </dl>
          <div className="description-box">
            <h2>Product Description</h2>
            <p>{current.description}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ListingFormPage({
  mode,
  form,
  setForm,
  onCancel,
  onSubmit,
}: {
  mode: "create" | "edit";
  form: ListingForm;
  setForm: React.Dispatch<React.SetStateAction<ListingForm>>;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="crumb">Seller Centre / Product</p>
          <h1>{mode === "create" ? "Add New Product" : "Edit Product"}</h1>
        </div>
        <div className="form-actions top">
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" onClick={onSubmit}><Upload size={17} /> Save and Publish</button>
        </div>
      </div>
      <section className="form-card">
        <SectionTitle icon={<Image />} title="Basic Information" />
        <div className="photo-uploader">
          <Camera size={28} />
          <strong>Add product photo</strong>
          <span>{form.image_id || "Image ID will appear here"}</span>
        </div>
        <Field label="Product Name">
          <input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} />
        </Field>
        <Field label="Product Description">
          <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <div className="form-grid">
          <Field label="Brand">
            <input value={form.brand} onChange={(event) => setForm((current) => ({ ...current, brand: event.target.value }))} />
          </Field>
          <Field label="Price">
            <input type="number" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: Number(event.target.value) }))} />
          </Field>
          <Field label="Image ID">
            <input value={form.image_id} onChange={(event) => setForm((current) => ({ ...current, image_id: event.target.value }))} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ListingStatus }))}>
              <option value="approved">Live</option>
              <option value="draft">Draft</option>
              <option value="suppressed">Suppressed</option>
            </select>
          </Field>
        </div>
      </section>
      <section className="form-card">
        <SectionTitle icon={<Package />} title="Sales Information" />
        <div className="form-grid three">
          <Field label="Stock">
            <input value="128" readOnly />
          </Field>
          <Field label="Weight">
            <input value="0.5 kg" readOnly />
          </Field>
          <Field label="Shipping Channel">
            <input value="Shopee Xpress" readOnly />
          </Field>
        </div>
      </section>
    </div>
  );
}

function ProfilePage({ profile, listings, onEdit }: { profile: SellerProfile; listings: Listing[]; onEdit: () => void }) {
  return (
    <div className="page-stack">
      <section className="profile-cover">
        <img src={profile.cover_url} alt="" />
        <div>
          <img src={profile.avatar_url} alt="" />
          <span>
            <h1>{profile.shop_name}</h1>
            <p>@{profile.username}</p>
          </span>
          <button className="primary-button" onClick={onEdit}><Edit3 size={17} /> Edit Profile</button>
        </div>
      </section>
      <section className="profile-grid">
        <div className="profile-card wide">
          <h2>Shop Introduction</h2>
          <p>{profile.description}</p>
        </div>
        <Metric title="Shop Rating" value={profile.rating.toFixed(1)} icon={<Store />} />
        <Metric title="Response Rate" value={`${profile.response_rate}%`} icon={<Bell />} />
        <Metric title="Followers" value={profile.followers.toLocaleString()} icon={<UserRound />} />
        <Metric title="Products" value={listings.length.toString()} icon={<Package />} />
        <div className="profile-card">
          <h2>Contact</h2>
          <p>{profile.email}</p>
          <p>{profile.phone}</p>
          <p>{profile.pickup_address}</p>
        </div>
      </section>
    </div>
  );
}

function ProfileEditPage({
  form,
  setForm,
  onCancel,
  onSubmit,
}: {
  form: Partial<SellerProfile>;
  setForm: React.Dispatch<React.SetStateAction<Partial<SellerProfile>>>;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="page-stack">
      <div className="page-title-row">
        <div>
          <p className="crumb">Seller Centre / Shop</p>
          <h1>Shop Profile</h1>
        </div>
        <div className="form-actions top">
          <button className="secondary-button" onClick={onCancel}>Cancel</button>
          <button className="primary-button" onClick={onSubmit}><Upload size={17} /> Save Profile</button>
        </div>
      </div>
      <section className="form-card">
        <SectionTitle icon={<Store />} title="Shop Information" />
        <div className="form-grid">
          <Field label="Shop Name">
            <input value={form.shop_name ?? ""} onChange={(event) => setForm((current) => ({ ...current, shop_name: event.target.value }))} />
          </Field>
          <Field label="Username">
            <input value={form.username ?? ""} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
          </Field>
          <Field label="Avatar URL">
            <input value={form.avatar_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, avatar_url: event.target.value }))} />
          </Field>
          <Field label="Cover URL">
            <input value={form.cover_url ?? ""} onChange={(event) => setForm((current) => ({ ...current, cover_url: event.target.value }))} />
          </Field>
        </div>
        <Field label="Shop Description">
          <textarea value={form.description ?? ""} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
        </Field>
        <div className="form-grid">
          <Field label="Pickup Address">
            <input value={form.pickup_address ?? ""} onChange={(event) => setForm((current) => ({ ...current, pickup_address: event.target.value }))} />
          </Field>
          <Field label="Phone">
            <input value={form.phone ?? ""} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          <Field label="Email">
            <input value={form.email ?? ""} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </Field>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function SectionTitle({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="section-title">
      {icon}
      <h2>{title}</h2>
    </div>
  );
}

function Metric({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="metric-card">
      <div>{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ActionTile({ icon, title, description, onClick }: { icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button className="action-tile" onClick={onClick}>
      <span>{icon}</span>
      <strong>{title}</strong>
      <small>{description}</small>
    </button>
  );
}

function ProductImage({ imageId, large = false }: { imageId: string; large?: boolean }) {
  return (
    <div className={large ? "product-image large" : "product-image"}>
      <img src={productImageUrl(imageId)} alt="" />
      <span>{imageId.split("_").slice(0, 2).join(" ")}</span>
    </div>
  );
}

function StatusPill({ status }: { status: ListingStatus }) {
  return <span className={`status-pill ${status}`}>{status === "approved" ? "Live" : status}</span>;
}

function latest(listing: Listing): ListingVersion {
  return listing.versions[listing.versions.length - 1];
}

function productImageUrl(imageId: string): string {
  if (imageId.includes("airpods") || imageId.includes("earbuds")) {
    return "https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=800&q=80";
  }
  if (imageId.includes("tshirt") || imageId.includes("uniqlo")) {
    return "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80";
  }
  if (imageId.includes("bag")) {
    return "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&w=800&q=80";
  }
  return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80";
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
