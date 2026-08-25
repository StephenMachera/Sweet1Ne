"""Permission gating and branch scoping — the security boundary.

If these fail, someone can reach data they shouldn't. Staff records hold
National Insurance numbers, dates of birth and home addresses, so a scoping
bug here is a real problem rather than a cosmetic one.
"""


class TestStaffAccess:
    def test_a_waiter_cannot_list_staff(self, as_staff, waiter):
        client = as_staff(waiter)

        response = client.get("/api/v1/staff")

        assert response.status_code == 403

    def test_a_manager_can_list_staff(self, as_staff, manager):
        client = as_staff(manager)

        response = client.get("/api/v1/staff")

        assert response.status_code == 200

    def test_a_director_can_list_staff(self, as_staff, director):
        """Super-admins bypass every permission check, which is why the
        Director fixture's role has no permissions attached."""
        client = as_staff(director)

        response = client.get("/api/v1/staff")

        assert response.status_code == 200

    def test_a_chef_cannot_list_staff(self, as_staff, chef):
        client = as_staff(chef)

        response = client.get("/api/v1/staff")

        assert response.status_code == 403


class TestRoleAccess:
    def test_a_waiter_cannot_create_roles(self, as_staff, waiter):
        client = as_staff(waiter)

        response = client.post(
            "/api/v1/roles", json={"name": "Sneaky", "permission_keys": []}
        )

        assert response.status_code == 403

    def test_a_manager_can_read_roles_without_managing_them(
        self, as_staff, manager
    ):
        """Reading is widened to manage_staff so the staff form's role
        dropdown works — but that shouldn't grant editing."""
        client = as_staff(manager)

        response = client.get("/api/v1/roles")

        assert response.status_code == 200

    def test_a_manager_cannot_create_roles(self, as_staff, manager):
        client = as_staff(manager)

        response = client.post(
            "/api/v1/roles", json={"name": "New role", "permission_keys": []}
        )

        assert response.status_code == 403


class TestBranchScoping:
    def test_a_manager_sees_only_their_own_branch_staff(
        self, as_staff, manager, waiter, westlands_manager
    ):
        """Downtown's manager should see Downtown staff and nobody from
        Westlands, regardless of what they ask for."""
        client = as_staff(manager)

        response = client.get("/api/v1/staff")
        emails = {s["email"] for s in response.json()}

        assert "waiter@test.com" in emails
        assert "westlands@test.com" not in emails

    def test_a_director_sees_staff_at_every_branch(
        self, as_staff, director, waiter, westlands_manager
    ):
        client = as_staff(director)

        response = client.get("/api/v1/staff")
        emails = {s["email"] for s in response.json()}

        assert "waiter@test.com" in emails
        assert "westlands@test.com" in emails

    def test_a_manager_sees_only_their_own_branch_tables(
        self, as_staff, manager, tables
    ):
        downtown_table, westlands_table = tables
        client = as_staff(manager)

        response = client.get("/api/v1/tables")
        ids = {t["id"] for t in response.json()}

        assert str(downtown_table.id) in ids
        assert str(westlands_table.id) not in ids

    def test_a_manager_cannot_edit_another_branchs_table(
        self, as_staff, manager, tables
    ):
        _, westlands_table = tables
        client = as_staff(manager)

        response = client.patch(
            f"/api/v1/tables/{westlands_table.id}", json={"seats": 99}
        )

        assert response.status_code == 403

    def test_a_manager_cannot_widen_their_scope_via_the_query_string(
        self, as_staff, manager, branches, tables
    ):
        """Passing another branch's id shouldn't override the caller's own
        scope — their branch always wins."""
        _, westlands = branches
        _, westlands_table = tables
        client = as_staff(manager)

        response = client.get(f"/api/v1/tables?branch_id={westlands.id}")
        ids = {t["id"] for t in response.json()}

        assert str(westlands_table.id) not in ids


class TestPayVisibility:
    def test_a_manager_with_pay_access_sees_salaries(
        self, as_staff, manager, waiter, db
    ):
        from app.models.staff import Staff

        # Give the waiter a salary to look for.
        record = db.get(Staff, waiter.id)
        record.salary = 12.50
        record.pay_type = "hourly"
        record.national_insurance_number = "QQ123456C"
        db.flush()

        client = as_staff(manager)
        response = client.get("/api/v1/staff")

        target = next(s for s in response.json() if s["email"] == "waiter@test.com")
        assert "salary" in target
        assert target["salary"] == 12.50

    def test_a_supervisor_without_pay_access_sees_no_salaries(
        self, as_staff, supervisor, waiter, db
    ):
        """manage_staff and view_staff_pay genuinely come apart — a shift
        supervisor can add people without seeing what anyone earns."""
        from app.models.staff import Staff

        record = db.get(Staff, waiter.id)
        record.salary = 12.50
        record.national_insurance_number = "QQ123456C"
        db.flush()

        client = as_staff(supervisor)
        response = client.get("/api/v1/staff")

        target = next(s for s in response.json() if s["email"] == "waiter@test.com")
        assert "salary" not in target
        assert "national_insurance_number" not in target

    def test_a_supervisor_cannot_write_pay_fields(
        self, as_staff, supervisor, waiter, db
    ):
        """Writing is stripped, not just reading — otherwise someone could
        set a salary they aren't allowed to see."""
        from app.models.staff import Staff

        client = as_staff(supervisor)

        response = client.patch(
            f"/api/v1/staff/{waiter.id}",
            json={"full_name": "New Name", "salary": 99999},
        )

        assert response.status_code == 200

        db.expire_all()
        record = db.get(Staff, waiter.id)
        assert record.full_name == "New Name"   # the allowed field went through
        assert record.salary is None            # the pay field was dropped


class TestStationAccess:
    def test_a_chef_can_read_the_kitchen_queue(self, as_staff, chef):
        client = as_staff(chef)

        response = client.get("/api/v1/station/kitchen/orders")

        assert response.status_code == 200

    def test_a_chef_cannot_read_the_bar_queue(self, as_staff, chef):
        """Holding one station's permission shouldn't open the other's
        screen — the route checks the specific station, not just that the
        caller works at some station."""
        client = as_staff(chef)

        response = client.get("/api/v1/station/bar/orders")

        assert response.status_code == 403

    def test_a_bartender_can_read_the_bar_queue(self, as_staff, bartender):
        client = as_staff(bartender)

        response = client.get("/api/v1/station/bar/orders")

        assert response.status_code == 200

    def test_a_bartender_cannot_read_the_kitchen_queue(self, as_staff, bartender):
        client = as_staff(bartender)

        response = client.get("/api/v1/station/kitchen/orders")

        assert response.status_code == 403

    def test_an_unknown_station_is_rejected(self, as_staff, chef):
        client = as_staff(chef)

        response = client.get("/api/v1/station/pastry/orders")

        assert response.status_code == 404

    def test_a_waiter_cannot_reach_any_station(self, as_staff, waiter):
        client = as_staff(waiter)

        response = client.get("/api/v1/station/kitchen/orders")

        assert response.status_code == 403


class TestSuperAdminBypass:
    def test_a_director_reaches_routes_their_role_has_no_permission_for(
        self, as_staff, director
    ):
        """The Director role has an empty permission list — everything it
        can do comes from is_super_admin."""
        client = as_staff(director)

        for path in (
            "/api/v1/staff",
            "/api/v1/roles",
            "/api/v1/tables",
            "/api/v1/promos",
        ):
            response = client.get(path)
            assert response.status_code == 200, f"{path} returned {response.status_code}"