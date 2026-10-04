"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchApi } from "@/lib/api";
import { ManagedAdmin } from "@/types";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

type FormState = {
  full_name: string;
  email: string;
  username: string;
  password: string;
  department: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  full_name: "",
  email: "",
  username: "",
  password: "",
  department: "",
  is_active: true,
};

export default function AddAdminsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [admins, setAdmins] = useState<ManagedAdmin[]>([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAdmins = useCallback(
    async (term = search) => {
      setLoading(true);
      try {
        const query = term.trim()
          ? `?search=${encodeURIComponent(term.trim())}`
          : "";
        setAdmins(await fetchApi<ManagedAdmin[]>(`/api/addadmins${query}`));
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Unable to load administrators",
        );
      } finally {
        setLoading(false);
      }
    },
    [search],
  );

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login?redirect=/addadmins");
      return;
    }
    if (user.role !== "MASTER_ADMIN" && user.role !== "SUPER_ADMIN") {
      router.push("/admin");
      return;
    }
    // The page must load only after authentication state has settled.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAdmins();
  }, [authLoading, user, router, loadAdmins]);

  const updateForm = (field: keyof FormState, value: string | boolean) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const startEdit = (admin: ManagedAdmin) => {
    setEditingId(admin.id);
    setForm({
      full_name: admin.full_name || "",
      email: admin.email || "",
      username: admin.username,
      password: "",
      department: admin.department || "",
      is_active: admin.is_active,
    });
    setError(null);
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await fetchApi(`/api/addadmins/${editingId}`, {
          method: "PUT",
          body: JSON.stringify({
            full_name: form.full_name,
            email: form.email,
            username: form.username,
            department: form.department || null,
          }),
        });
      } else {
        await fetchApi("/api/addadmins", {
          method: "POST",
          body: JSON.stringify(form),
        });
      }
      resetForm();
      await loadAdmins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save administrator",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (admin: ManagedAdmin) => {
    try {
      await fetchApi(`/api/addadmins/${admin.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !admin.is_active }),
      });
      await loadAdmins();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update status");
    }
  };

  const removeAdmin = async (admin: ManagedAdmin) => {
    if (
      !window.confirm(
        `Delete ${admin.full_name || admin.username}? This cannot be undone.`,
      )
    )
      return;
    try {
      await fetchApi(`/api/addadmins/${admin.id}`, { method: "DELETE" });
      await loadAdmins();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete administrator",
      );
    }
  };

  if (
    authLoading ||
    !user ||
    (user.role !== "MASTER_ADMIN" && user.role !== "SUPER_ADMIN")
  )
    return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">
            Administrator accounts
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage access for the LMS administration team.
          </p>
        </div>
        <Button onClick={resetForm} className="gap-2">
          <Plus className="w-4 h-4" /> Add admin
        </Button>
      </div>

      {error && (
        <div className="border border-red-200 bg-red-50 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardContent className="p-5">
          <form
            onSubmit={submit}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            <Input
              label="Full name"
              value={form.full_name}
              onChange={(e) => updateForm("full_name", e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
              required
            />
            <Input
              label="Username"
              value={form.username}
              onChange={(e) => updateForm("username", e.target.value)}
              required
            />
            {!editingId && (
              <Input
                label="Temporary password"
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
                required
              />
            )}
            <Input
              label="Department"
              value={form.department}
              onChange={(e) => updateForm("department", e.target.value)}
            />
            {!editingId && (
              <label className="flex items-center gap-2 text-sm text-text-primary mt-6">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm("is_active", e.target.checked)}
                />{" "}
                Active account
              </label>
            )}
            <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-3">
              <Button type="submit" isLoading={saving}>
                {editingId ? "Save changes" : "Create admin"}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm}>
                  <X className="w-4 h-4 mr-1" /> Cancel
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-4 border-b border-border-subtle flex items-center gap-2">
            <Search className="w-4 h-4 text-text-muted" />
            <input
              className="w-full text-sm outline-none"
              placeholder="Search by name, email, or username"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadAdmins()}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-page-bg text-left text-xs text-text-secondary">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Username</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-text-secondary"
                    >
                      Loading administrators...
                    </td>
                  </tr>
                ) : (
                  admins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium">
                          {admin.full_name || "-"}
                        </div>
                        <div className="text-xs text-text-secondary">
                          {admin.email || "-"}
                        </div>
                      </td>
                      <td className="px-4 py-3">{admin.username}</td>
                      <td className="px-4 py-3">{admin.department || "-"}</td>
                      <td className="px-4 py-3">{admin.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={
                            admin.is_active
                              ? "text-green-700"
                              : "text-text-secondary"
                          }
                        >
                          {admin.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Edit admin"
                            onClick={() => startEdit(admin)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title={
                              admin.is_active
                                ? "Deactivate admin"
                                : "Activate admin"
                            }
                            onClick={() => toggleStatus(admin)}
                          >
                            {admin.is_active ? (
                              <X className="w-4 h-4" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Delete admin"
                            onClick={() => removeAdmin(admin)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
                {!loading && admins.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-text-secondary"
                    >
                      No administrator accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
