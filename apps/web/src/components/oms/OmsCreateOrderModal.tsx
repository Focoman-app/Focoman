"use client";

import type React from "react";
import Link from "next/link";
import type {
  Customer,
  StudioPackage,
  StudioServiceConfig,
} from "@focoman/types";
import { PRESET_EVENT_TYPES, type NewOrderFormState } from "./omsConstants";

interface OmsCreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  studioSlug: string;
  newOrderForm: NewOrderFormState;
  setNewOrderForm: React.Dispatch<React.SetStateAction<NewOrderFormState>>;
  formError: string | null;
  isSubmitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
  studioCustomers: Customer[];
  matchingCustomers: Customer[];
  duplicateCustomerWarning: Customer | null;
  showCustomerDropdown: boolean;
  setShowCustomerDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectExistingCustomer: (customer: Customer) => void;
  activeStudioPackages: StudioPackage[];
  selectedPackageId: string;
  onSelectPackage: (pkgId: string) => void;
  availableServices: StudioServiceConfig[];
  studioServicesList: StudioServiceConfig[];
  showServicesDropdown: boolean;
  setShowServicesDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  onToggleService: (serviceName: string) => void;
  calculateOrderPrice: (selectedServices: string[], packageId?: string) => number;
  hasCrm?: boolean;
}

export function OmsCreateOrderModal({
  isOpen,
  onClose,
  studioSlug,
  newOrderForm,
  setNewOrderForm,
  formError,
  isSubmitting,
  onSubmit,
  studioCustomers,
  matchingCustomers,
  duplicateCustomerWarning,
  showCustomerDropdown,
  setShowCustomerDropdown,
  onSelectExistingCustomer,
  activeStudioPackages,
  selectedPackageId,
  onSelectPackage,
  availableServices,
  studioServicesList,
  showServicesDropdown,
  setShowServicesDropdown,
  onToggleService,
  calculateOrderPrice,
  hasCrm = true,
}: OmsCreateOrderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl bg-white shadow-2xl border border-border-default animate-in fade-in duration-150 my-auto">
        {/* Modal Header (Pinned at Top) */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border-default shrink-0">
          <div>
            <h3 className="text-lg font-bold text-text-primary">
              Register Confirmed Order
            </h3>
            <p className="text-xs text-text-secondary">
              Begins automated 3-state production workflow
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-text-tertiary hover:text-text-primary p-1.5 rounded-lg hover:bg-surface-app transition"
            aria-label="Close dialog"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="overflow-y-auto p-6 space-y-4 flex-1">
            {formError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-600 font-medium">
                {formError}
              </div>
            )}

            {/* Customer Full Name with Autocomplete */}
            <div className="relative">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-text-primary">
                  Customer Full Name *
                </label>
                {hasCrm && studioCustomers.length > 0 && (
                  <span className="text-[10px] text-text-tertiary">
                    {studioCustomers.length} registered in CRM
                  </span>
                )}
              </div>
              <div className="relative mt-1">
                <input
                  type="text"
                  required
                  placeholder={hasCrm ? "e.g. Ramesh Kumar (Search existing or type new)" : "e.g. Ramesh Kumar"}
                  value={newOrderForm.customerName}
                  onFocus={() => {
                    if (hasCrm) setShowCustomerDropdown(true);
                  }}
                  onChange={(e) => {
                    setNewOrderForm({ ...newOrderForm, customerName: e.target.value });
                    if (hasCrm) setShowCustomerDropdown(true);
                  }}
                  className={`w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary ${
                    hasCrm && studioCustomers.length > 0 ? "pr-10" : "pr-3.5"
                  }`}
                />
                {hasCrm && studioCustomers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowCustomerDropdown((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-brand-blue-primary p-0.5"
                    tabIndex={-1}
                    title="Toggle customer list"
                  >
                    <svg
                      className={`w-3.5 h-3.5 transition-transform ${
                        showCustomerDropdown ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
              </div>

              {newOrderForm.customerName.trim().length > 0 &&
                (newOrderForm.customerName.match(/[a-zA-Z]/g) || []).length < 3 && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">
                    Name must have at least 3 letters.
                  </p>
                )}

              {/* Customer Autocomplete Dropdown */}
              {hasCrm && showCustomerDropdown && matchingCustomers.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-2xl border border-border-default bg-white p-2 shadow-xl animate-in fade-in duration-100 max-h-48 overflow-y-auto">
                  <div className="flex items-center justify-between px-2 pb-1 border-b border-border-default text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                    <span>Select Existing Client or Type New</span>
                    <button
                      type="button"
                      onClick={() => setShowCustomerDropdown(false)}
                      className="text-brand-blue-primary hover:underline lowercase font-semibold"
                    >
                      close
                    </button>
                  </div>
                  <div className="space-y-0.5 pt-1">
                    {matchingCustomers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => onSelectExistingCustomer(c)}
                        className="flex items-center justify-between px-2.5 py-2 rounded-xl text-xs hover:bg-brand-blue-50/80 cursor-pointer transition text-left"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-text-primary truncate">{c.name}</p>
                          <p className="text-[10px] text-text-secondary truncate">
                            {c.phone || "No phone"} {c.email ? `· ${c.email}` : ""}
                          </p>
                        </div>
                        <span className="text-[10px] font-bold text-brand-blue-primary bg-brand-blue-100/60 px-2 py-0.5 rounded-full shrink-0 ml-2">
                          CRM Link
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-primary">
                  Phone Number{" "}
                  <span className="font-normal text-text-tertiary">(Optional)</span>
                </label>
                <div className="mt-1 flex gap-1.5">
                  <input
                    type="text"
                    placeholder="+91"
                    value={newOrderForm.countryCode}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, countryCode: e.target.value })
                    }
                    className="w-20 rounded-xl border border-border-default bg-surface-app px-2 py-2 text-xs font-semibold text-text-primary text-center outline-none focus:border-brand-blue-primary"
                    title="Country Code (e.g. +91, +1, +44)"
                  />
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={newOrderForm.customerPhone}
                    onChange={(e) =>
                      setNewOrderForm({
                        ...newOrderForm,
                        customerPhone: e.target.value,
                      })
                    }
                    className="flex-1 min-w-0 rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-text-primary">
                  Customer Email{" "}
                  <span className="font-normal text-text-tertiary">(Optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="client@gmail.com"
                  value={newOrderForm.customerEmail}
                  onChange={(e) =>
                    setNewOrderForm({ ...newOrderForm, customerEmail: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                />
              </div>
            </div>

            {/* Non-Blocking Duplicate Match Notice */}
            {hasCrm && duplicateCustomerWarning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-3 text-xs text-amber-950 flex items-start gap-2.5 animate-in fade-in duration-150">
                <span className="text-base leading-none shrink-0 mt-0.5">ℹ️</span>
                <div className="space-y-0.5 min-w-0">
                  <p className="font-bold">
                    Existing CRM Customer Match:{" "}
                    <span className="underline">{duplicateCustomerWarning.name}</span>
                    {duplicateCustomerWarning.phone
                      ? ` (${duplicateCustomerWarning.phone})`
                      : ""}
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    This order will be automatically linked to their existing customer profile and lifetime bookings in CRM. You can continue without changing the name.
                  </p>
                </div>
              </div>
            )}

            {/* Dynamic Automated Customer Notifications */}
            {(Boolean(newOrderForm.customerPhone.trim()) ||
              Boolean(newOrderForm.customerEmail.trim())) && (
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-950">
                    Automated Client Notifications
                  </span>
                </div>

                <div className="space-y-2 pt-0.5">
                  {Boolean(newOrderForm.customerPhone.trim()) && (
                    <label className="flex items-center gap-2.5 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newOrderForm.notifyWhatsApp}
                        onChange={(e) =>
                          setNewOrderForm({
                            ...newOrderForm,
                            notifyWhatsApp: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary"
                      />
                      <span className="text-xs font-medium text-text-primary">
                        Send automated order updates via <strong>WhatsApp</strong>
                      </span>
                    </label>
                  )}

                  {Boolean(newOrderForm.customerEmail.trim()) && (
                    <label className="flex items-center gap-2.5 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newOrderForm.notifyEmail}
                        onChange={(e) =>
                          setNewOrderForm({
                            ...newOrderForm,
                            notifyEmail: e.target.checked,
                          })
                        }
                        className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary"
                      />
                      <span className="text-xs font-medium text-text-primary">
                        Send automated order updates via <strong>Email</strong>
                      </span>
                    </label>
                  )}
                </div>
              </div>
            )}

            {/* Event Type Dropdown and Custom Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-primary">
                  Event Type *
                </label>
                <select
                  value={newOrderForm.eventType}
                  onChange={(e) =>
                    setNewOrderForm({ ...newOrderForm, eventType: e.target.value })
                  }
                  className="mt-1 w-full rounded-xl border border-border-default bg-white px-3.5 py-2 text-xs font-medium text-text-primary outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                >
                  {PRESET_EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
                {newOrderForm.eventType === "Other" && (
                  <input
                    type="text"
                    placeholder="Specify event type (Optional)"
                    value={newOrderForm.customEventType}
                    onChange={(e) =>
                      setNewOrderForm({
                        ...newOrderForm,
                        customEventType: e.target.value,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-border-default px-3 py-1.5 text-xs outline-none focus:border-brand-blue-primary"
                  />
                )}
              </div>

              <div>
                <label
                  htmlFor="register-order-event-date"
                  className="block text-xs font-bold text-text-primary cursor-pointer"
                >
                  Event Date *
                </label>
                <input
                  id="register-order-event-date"
                  type="date"
                  required
                  value={newOrderForm.eventDate}
                  onChange={(e) =>
                    setNewOrderForm({ ...newOrderForm, eventDate: e.target.value })
                  }
                  onClick={(e) => {
                    try {
                      e.currentTarget.showPicker?.();
                    } catch {}
                  }}
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary cursor-pointer [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-text-primary">
                Event Location{" "}
                <span className="font-normal text-text-tertiary">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. Chennai, Bangalore"
                value={newOrderForm.eventLocation}
                onChange={(e) =>
                  setNewOrderForm({
                    ...newOrderForm,
                    eventLocation: e.target.value,
                  })
                }
                className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
              />
            </div>

            {/* Studio Package / Combo Quick Selector */}
            {activeStudioPackages.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-text-primary">
                    Package / Combo{" "}
                    <span className="font-normal text-text-tertiary">(Optional)</span>
                  </label>
                  <Link
                    href={`/${studioSlug}/dashboard/services`}
                    target="_blank"
                    className="text-[10px] text-brand-blue-primary font-semibold hover:underline"
                  >
                    Manage Catalog ↗
                  </Link>
                </div>
                <select
                  value={selectedPackageId}
                  onChange={(e) => onSelectPackage(e.target.value)}
                  className="w-full rounded-xl border border-brand-blue-soft bg-brand-blue-50/50 px-3.5 py-2 text-xs font-semibold text-text-primary outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                >
                  <option value="">
                    -- Custom Order (Choose Services Below) --
                  </option>
                  {activeStudioPackages.map((pkg) => (
                    <option key={pkg.id} value={pkg.id}>
                      {pkg.name} — ₹{pkg.price.toLocaleString("en-IN")} (
                      {pkg.services.length} services)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Studio Services and Deliverables Dropdown with Multi-Select */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-text-primary">
                  Studio Services and Deliverables *
                </label>
                <span className="text-[10px] font-semibold text-text-tertiary">
                  {newOrderForm.services.length} Selected
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Select or type custom service and press Enter..."
                  value={newOrderForm.customServiceInput}
                  onChange={(e) => {
                    setNewOrderForm({
                      ...newOrderForm,
                      customServiceInput: e.target.value,
                    });
                    if (!showServicesDropdown) setShowServicesDropdown(true);
                  }}
                  onFocus={() => setShowServicesDropdown(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const custom = newOrderForm.customServiceInput.trim();
                      if (custom && !newOrderForm.services.includes(custom)) {
                        const nextServices = [...newOrderForm.services, custom];
                        const autoPrice = calculateOrderPrice(
                          nextServices,
                          selectedPackageId
                        );
                        setNewOrderForm({
                          ...newOrderForm,
                          services: nextServices,
                          customServiceInput: "",
                          finalConfirmedPrice:
                            autoPrice > 0
                              ? autoPrice
                              : newOrderForm.finalConfirmedPrice,
                        });
                      }
                    }
                  }}
                  className="w-full rounded-xl border border-border-default px-3.5 py-2 pr-10 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                />
                <div
                  className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-text-tertiary hover:text-brand-blue-primary"
                  onClick={() => setShowServicesDropdown((prev) => !prev)}
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      showServicesDropdown ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {showServicesDropdown && (
                  <div className="absolute top-full z-20 left-0 right-0 mt-1.5 rounded-2xl border border-border-default bg-white shadow-xl p-2.5 space-y-1.5 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between px-2 pb-1 border-b border-border-default text-[10px] font-bold text-text-tertiary uppercase tracking-wider">
                      <span>
                        Studio Services ({newOrderForm.services.length} selected)
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowServicesDropdown(false)}
                        className="text-brand-blue-primary hover:underline lowercase font-semibold"
                      >
                        done
                      </button>
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                      {availableServices
                        .filter((svc) =>
                          svc.name
                            .toLowerCase()
                            .includes(newOrderForm.customServiceInput.toLowerCase())
                        )
                        .map((svc) => {
                          const isSvcSelected = newOrderForm.services.includes(
                            svc.name
                          );
                          return (
                            <label
                              key={svc.id}
                              className={`flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition select-none ${
                                isSvcSelected
                                  ? "bg-brand-blue-50/80 text-brand-blue-primary"
                                  : "text-text-primary hover:bg-surface-app"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={isSvcSelected}
                                  onChange={() => onToggleService(svc.name)}
                                  className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary shrink-0"
                                />
                                <div className="flex items-center gap-1.5 truncate">
                                  <span className="truncate">{svc.name}</span>
                                  {svc.isDeliverable && (
                                    <span className="rounded bg-amber-50 border border-amber-200 px-1 py-0.2 text-[8px] font-bold text-amber-700">
                                      Deliverable
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {svc.enabled && svc.defaultPrice > 0 && (
                                  <span className="text-[10px] font-semibold text-text-tertiary">
                                    ₹{svc.defaultPrice.toLocaleString("en-IN")}
                                  </span>
                                )}
                                {isSvcSelected && (
                                  <span className="text-[10px] font-bold text-brand-blue-primary">
                                    ✓
                                  </span>
                                )}
                              </div>
                            </label>
                          );
                        })}

                      {newOrderForm.services
                        .filter(
                          (s) =>
                            !availableServices.some(
                              (svc) => svc.name.toLowerCase() === s.toLowerCase()
                            )
                        )
                        .map((customSvc) => (
                          <label
                            key={customSvc}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-brand-blue-50/80 text-brand-blue-primary cursor-pointer transition select-none"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => onToggleService(customSvc)}
                                className="h-3.5 w-3.5 rounded border-border-default text-brand-blue-primary focus:ring-brand-blue-primary shrink-0"
                              />
                              <span className="truncate">{customSvc}</span>
                            </div>
                            <span className="text-[10px] font-bold text-brand-blue-primary shrink-0 ml-2">
                              Custom
                            </span>
                          </label>
                        ))}

                      {newOrderForm.customServiceInput.trim() &&
                        !availableServices.some(
                          (s) =>
                            s.name.toLowerCase() ===
                            newOrderForm.customServiceInput.trim().toLowerCase()
                        ) &&
                        !newOrderForm.services.includes(
                          newOrderForm.customServiceInput.trim()
                        ) && (
                          <div className="px-2.5 py-1.5 text-[10px] font-medium text-text-tertiary italic">
                            Press Enter to add &quot;
                            {newOrderForm.customServiceInput.trim()}&quot;
                          </div>
                        )}
                    </div>
                  </div>
                )}
              </div>

              {newOrderForm.services.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {newOrderForm.services.map((svc) => {
                    const matchedConfig = studioServicesList.find(
                      (s) => s.name.toLowerCase() === svc.toLowerCase()
                    );
                    return (
                      <span
                        key={svc}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-blue-50 px-2.5 py-1 text-xs font-semibold text-brand-blue-primary border border-brand-blue-soft"
                      >
                        <span>{svc}</span>
                        {matchedConfig &&
                          matchedConfig.enabled &&
                          matchedConfig.defaultPrice > 0 && (
                            <span className="text-[10px] font-normal text-text-tertiary">
                              (₹{matchedConfig.defaultPrice.toLocaleString("en-IN")})
                            </span>
                          )}
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            onToggleService(svc);
                          }}
                          className="text-xs font-bold text-brand-blue-primary hover:text-red-500 cursor-pointer ml-0.5 leading-none"
                          title={`Remove ${svc}`}
                        >
                          ×
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Pricing and Advance with Validation */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-text-primary">
                  Confirmed Total Price (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 75,000"
                  value={newOrderForm.finalConfirmedPrice ?? ""}
                  onChange={(e) =>
                    setNewOrderForm({
                      ...newOrderForm,
                      finalConfirmedPrice:
                        e.target.value === ""
                          ? ("" as unknown as number)
                          : Number(e.target.value),
                    })
                  }
                  className="mt-1 w-full rounded-xl border border-border-default px-3.5 py-2 text-xs outline-none focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                />
                {newOrderForm.services.length > 0 && (
                  <p className="mt-1 text-[11px] leading-tight text-text-tertiary">
                    {Number(newOrderForm.finalConfirmedPrice) > 0
                      ? "Auto-calculated from selected items above · Review and edit if needed"
                      : "Enter agreed total price for selected services"}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-text-primary">
                  Advance Received (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  placeholder="e.g. 25,000"
                  value={newOrderForm.advanceAmount ?? ""}
                  onChange={(e) =>
                    setNewOrderForm({
                      ...newOrderForm,
                      advanceAmount:
                        e.target.value === ""
                          ? ("" as unknown as number)
                          : Number(e.target.value),
                    })
                  }
                  className={`mt-1 w-full rounded-xl border px-3.5 py-2 text-xs outline-none focus:ring-1 ${
                    Number(newOrderForm.advanceAmount) >
                      Number(newOrderForm.finalConfirmedPrice) &&
                    Number(newOrderForm.finalConfirmedPrice) > 0
                      ? "border-status-error bg-red-50/50 text-status-error focus:ring-red-400"
                      : "border-border-default focus:border-brand-blue-primary focus:ring-brand-blue-primary"
                  }`}
                />
              </div>
              {Number(newOrderForm.advanceAmount) >
                Number(newOrderForm.finalConfirmedPrice) &&
                Number(newOrderForm.finalConfirmedPrice) > 0 && (
                  <div className="col-span-2 rounded-xl border border-red-200 bg-red-50 p-2.5 text-[11px] font-semibold text-status-error">
                    Advance amount cannot exceed the confirmed total price.
                  </div>
                )}
            </div>

            {/* Payment Summary Breakdown */}
            <div className="rounded-2xl border border-border-default bg-surface-app/70 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
                  Payment Summary
                </span>
                <span className="text-[10px] text-text-tertiary">
                  Auto-calculated breakdown
                </span>
              </div>

              <div className="space-y-1.5 pt-1 border-t border-border-divider text-xs">
                <div className="flex items-center justify-between text-text-secondary">
                  <span>Confirmed Total Price</span>
                  <span className="font-bold text-text-primary">
                    ₹
                    {Math.max(
                      0,
                      Number(newOrderForm.finalConfirmedPrice) || 0
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between text-text-secondary">
                  <span>Advance Received</span>
                  <span className="font-bold text-brand-blue-primary">
                    ₹
                    {Math.max(
                      0,
                      Number(newOrderForm.advanceAmount) || 0
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-border-divider font-bold">
                  <span className="text-text-primary">Remaining Amount</span>
                  <span
                    className={
                      Math.max(
                        0,
                        (Number(newOrderForm.finalConfirmedPrice) || 0) -
                          (Number(newOrderForm.advanceAmount) || 0)
                      ) > 0
                        ? "text-brand-orange-primary font-extrabold text-sm"
                        : "text-emerald-600 font-extrabold text-sm"
                    }
                  >
                    ₹
                    {Math.max(
                      0,
                      (Number(newOrderForm.finalConfirmedPrice) || 0) -
                        (Number(newOrderForm.advanceAmount) || 0)
                    ).toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>

            {/* 6-Digit Guest Access PIN */}
            <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950">
                  6-Digit Guest Access PIN
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setNewOrderForm({
                      ...newOrderForm,
                      passkeyPin: Math.floor(
                        100000 + Math.random() * 900000
                      ).toString(),
                    })
                  }
                  className="text-[11px] font-bold text-brand-blue-primary hover:underline"
                >
                  Regenerate PIN
                </button>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                {newOrderForm.customerEmail.trim() ? (
                  <>
                    Order tracking link will be sent to{" "}
                    <strong className="font-semibold text-amber-950">
                      {newOrderForm.customerEmail.trim()}
                    </strong>
                    . Your customer can track with their email or access instantly as a guest using this 6-digit PIN.
                  </>
                ) : (
                  <>
                    No customer email provided. Share this 6-digit PIN with your customer for guest order tracking.
                  </>
                )}
              </p>
              <div className="pt-1">
                <input
                  type="text"
                  maxLength={6}
                  value={newOrderForm.passkeyPin}
                  onChange={(e) =>
                    setNewOrderForm({
                      ...newOrderForm,
                      passkeyPin: e.target.value.replace(/\D/g, "").slice(0, 6),
                    })
                  }
                  className={`w-32 rounded-xl bg-white px-3.5 py-1.5 font-mono text-sm font-extrabold tracking-widest text-text-primary text-center outline-none transition ${
                    newOrderForm.passkeyPin.length !== 6
                      ? "border border-rose-400 focus:border-rose-500"
                      : "border border-amber-300 focus:border-brand-blue-primary focus:ring-1 focus:ring-brand-blue-primary"
                  }`}
                />
                {newOrderForm.passkeyPin.length !== 6 && (
                  <p className="mt-1 text-[11px] font-medium text-rose-600">
                    PIN must be 6 digits.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer (Pinned at Bottom) */}
          <div className="p-4 sm:px-6 border-t border-border-default bg-surface-app/40 shrink-0 flex gap-3 justify-end rounded-b-3xl">
            <button
              type="button"
              onClick={onClose}
              className="btn-brand-outline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                (newOrderForm.customerName.match(/[a-zA-Z]/g) || []).length < 3 ||
                newOrderForm.passkeyPin.length !== 6 ||
                (Number(newOrderForm.advanceAmount) >
                  Number(newOrderForm.finalConfirmedPrice) &&
                  Number(newOrderForm.finalConfirmedPrice) > 0)
              }
              className="btn-brand-blue disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Creating..." : "Confirm and Save Order"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
