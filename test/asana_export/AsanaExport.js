
describe("AsanaExport", function() {
	var exp;
	beforeEach(function() {
		exp = AsanaExportInMemory.clone();
	});

	describe("#users()", function() {
		it("should return no users", function() {
			exp.prepareForImport();

			exp.users().should.deep.equal([]);
		});

		it("should return one user with a list of assigned items", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1, task_list: 4 });
			exp.addObject(4, "ItemList", { followers_du: [], name: "My Tasks", is_project: true, assignee: 3, is_archived: false, items: [10,11,12] });
			exp.prepareForImport();

			exp.users().mapPerform("performGets", ["email", "name", "sourceId", "sourceItemIds"]).should.deep.equal([
				{ sourceId: 1, name: "mike", email: "mike@example.com", sourceItemIds: [10,11,12] }
			]);
		});

		it("should not return deactivated users", function() {
			exp.addObject(1, "User", { name: "mike", deactivated: true });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1, task_list: 4 });
			exp.addObject(4, "ItemList", { followers_du: [], name: "My Tasks", is_project: true, assignee: 3, is_archived: false, items: [10,11,12] });
			exp.prepareForImport();

			exp.users().mapPerform("performGets", ["email", "name", "sourceId", "sourceItemIds"]).should.deep.equal([]);
		});
	});

	describe("#teams()", function() {
		it("should return no teams", function() {
			exp.prepareForImport();

			exp.teams().should.deep.equal([]);
		});

		it("should return one team", function() {
			exp.addObject(1, "Team", { name: "team1", team_type: "REQUEST_TO_JOIN" });
			exp.prepareForImport();

			exp.teams().mapPerform("performGets", ["sourceId", "name", "teamType", "sourceMemberIds"]).should.deep.equal([
				{ sourceId: 1, name: "team1", teamType: "REQUEST_TO_JOIN", sourceMemberIds: [] }
			]);
		});

		it("should return the correct members of a team", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1 });
			exp.addObject(4, "Team", { name: "team1", team_type: "REQUEST_TO_JOIN" });
			exp.addObject(5, "TeamMembership", { team: 4, member: 3 });
			exp.prepareForImport();

			exp.teams().mapPerform("performGets", ["sourceId", "name", "teamType", "sourceMemberIds"]).should.deep.equal([
				{ sourceId: 4, name: "team1", teamType: "REQUEST_TO_JOIN", sourceMemberIds: [1] }
			]);
		});

		it("should not include 'limited_access=true' users in a team", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1 });
			exp.addObject(4, "Team", { name: "team1", team_type: "REQUEST_TO_JOIN" });
			exp.addObject(5, "TeamMembership", { team: 4, member: 3, limited_access: true });
			exp.prepareForImport();

			exp.teams().mapPerform("performGets", ["sourceId", "name", "teamType", "sourceMemberIds"]).should.deep.equal([
				{ sourceId: 4, name: "team1", teamType: "REQUEST_TO_JOIN", sourceMemberIds: [] }
			]);
		});
	});

	describe("#projects()", function() {
		it("should return no projects", function() {
			exp.prepareForImport();

			exp.projects().should.deep.equal([]);
		});

		it("should return one project, no tags or user task lists", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1 });
			exp.addObject(4, "Team", { name: "team1", team_type: "REQUEST_TO_JOIN" });
			exp.addObject(5, "ItemList", { followers_du: [], name: "project1", description: "description", is_project: true, is_archived: false, items: [10,11,12], team: 4, stories: [] });
			exp.addObject(6, "ItemList", { followers_du: [], name: "tag1", is_project: false, is_archived: false, items: [10,11,12], team: 4, stories: [] });
			exp.addObject(7, "ItemList", { followers_du: [], name: "My Tasks", is_project: true, assignee: 3, is_archived: false, items: [10,11,12] });
			exp.addObject(8, "ProjectMembership", { project: 5, member: 3 });
			exp.prepareForImport();

			exp.projects().mapPerform("performGets", ["sourceId", "archived", "name", "color", "notes", "sourceTeamId", "sourceMemberIds", "sourceItemIds"]).should.deep.equal([
				{ sourceId: 5, archived: false, name: "project1", color: null, notes: "description", sourceTeamId: 4, sourceMemberIds: [1], sourceItemIds: [10,11,12] }
			]);
		});
	});

	describe("#tags()", function() {
		it("should return no tags", function() {
			exp.prepareForImport();

			exp.tags().should.deep.equal([]);
		});

		it("should return one tag, no projects or user task lists", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1 });
			exp.addObject(4, "Team", { name: "team1", team_type: "REQUEST_TO_JOIN" });
			exp.addObject(5, "ItemList", { followers_du: [], name: "project1", description: "description", is_project: true, is_archived: false, items: [10,11,12], team: 4, stories: [] });
			exp.addObject(6, "ItemList", { followers_du: [], name: "tag1", is_project: false, is_archived: false, items: [10,11,12], team: 4, stories: [] });
			exp.addObject(7, "ItemList", { followers_du: [], name: "My Tasks", is_project: true, assignee: 3, is_archived: false, items: [10,11,12] });
			exp.prepareForImport();

			exp.tags().mapPerform("performGets", ["sourceId", "name", "sourceTeamId", "sourceItemIds"]).should.deep.equal([
				{ sourceId: 6, name: "tag1", sourceTeamId: 4, sourceItemIds: [10,11,12] }
			]);
		});
	});

	describe("#taskCursorDataSource()", function() {
		it("should return no tasks", function() {
			exp.prepareForImport();

			exp.taskCursorDataSource()(0, 50).should.deep.equal([]);
		});

		it("should return one task and subtask with assignee and follower", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1 });
			exp.addObject(4, "Team", { name: "team1", team_type: "REQUEST_TO_JOIN" });
			exp.addObject(5, "ItemList", { followers_du: [], name: "project1", description: "description", is_project: true, is_archived: false, items: [7], team: 4, stories: [] });
			exp.addObject(6, "ItemList", { followers_du: [], name: "tag1", is_project: false, is_archived: false, items: [7], team: 4, stories: [] });
			exp.addObject(7, "Task", { name: "task1", schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", description: "description", assignee: 3, attachments: [], items: [8], stories: [], followers_du: [3] });
			exp.addObject(8, "Task", { name: "subtask1", schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", description: "description", assignee: 3, attachments: [], items: [], stories: [], followers_du: [3] });
			exp.prepareForImport();

			exp.taskCursorDataSource()(0, 50).mapPerform("performGets", ["sourceId", "name", "notes", "completed", "assigneeStatus", "dueOn", "sourceItemIds", "sourceAssigneeId", "sourceFollowerIds"]).should.deep.equal([
				{ sourceId: 7, name: "task1",    notes: "description", completed: false, dueOn: "2023-11-30 00:00:00", assigneeStatus: "upcoming", sourceItemIds: [8], sourceAssigneeId: 1, sourceFollowerIds: [1] },
				{ sourceId: 8, name: "subtask1", notes: "description", completed: false, dueOn: "2023-11-30 00:00:00", assigneeStatus: "upcoming", sourceItemIds: [],  sourceAssigneeId: 1, sourceFollowerIds: [1] }
			]);
		});

		it("should not return trashed Tasks", function() {
			exp.addObject(1, "Task", { __trashed_at: "2023-11-30 00:00:00", name: "task1", schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", description: "description", attachments: [], items: [], stories: [], followers_du: [] });
			exp.prepareForImport();

			exp.taskCursorDataSource()(0, 50).mapPerform("performGets", ["sourceId", "name", "notes", "completed", "assigneeStatus", "dueOn", "sourceItemIds", "sourceAssigneeId", "sourceFollowerIds"]).should.deep.equal([]);
		});

		it("should paginate cursor correctly", function() {
			exp.addObject(1, "Task", { name: "task1", schedule_status: "UPCOMING", description: "", attachments: [], items: [], stories: [], followers_du: [] });
			exp.addObject(2, "Task", { name: "task2", schedule_status: "UPCOMING", description: "", attachments: [], items: [], stories: [], followers_du: [] });
			exp.prepareForImport();

			exp.taskCursorDataSource()(0, 1).length.should.equal(1);
			exp.taskCursorDataSource()(1, 1).length.should.equal(1);
			exp.taskCursorDataSource()(2, 1).length.should.equal(0);
		});

		it("should return task with two stories with reformatted texts", function() {
			exp.addObject(1, "User", { name: "mike" });
			exp.addObject(2, "VerifiedEmail", { ve_user: 1, ve_email: "mike@example.com" });
			exp.addObject(3, "DomainUser", { user: 1 });
			exp.addObject(4, "Task", { name: "task1", schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", description: "description", attachments: [2], items: [], stories: [5, 7, 6], followers_du: [] });
			exp.addObject(5, "Comment", { creator_du: 3, __creation_time: "2014-11-17 22:44:22", text: "MY COMMENT" });
			exp.addObject(6, "TaskNameChangedStory", { creator_du: 3, __creation_time: "2014-11-17 22:44:22", text: "changed the name to \"task1\"" });
			exp.addObject(7, "TaskDescriptionChangedStory", { creator_du: 3, __creation_time: "2014-11-17 22:44:22", text: "removed the description" });
			exp.prepareForImport();

			exp.taskCursorDataSource()(0, 50)[0].stories().should.deep.equal([
				"mike commented on Mon Nov 17 2014 22:44:22:\n\nMY COMMENT",
				"mike removed the description",
				"mike changed the name to \"task1\""
			]);
		});

		it("should not include AddAttachmentStory", function() {
			exp.addObject(1, "Task", { name: "task1", schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", description: "description", attachments: [], items: [], stories: [2], followers_du: [] });
			exp.addObject(2, "AddAttachmentStory", { creator_du: null, __creation_time: "2014-11-17 22:44:22", text: "removed the description" });
			exp.prepareForImport();

			exp.taskCursorDataSource()(0, 50)[0].stories().length.should.equal(0);
		});
	});

	describe("#attachmentCursorDataSource()", function() {
		it("should return no attachments", function() {
			exp.prepareForImport();

			exp.attachmentCursorDataSource()(0, 50).should.deep.equal([]);
		});

		it("should return one attachment", function() {
			exp.addObject(1, "Task", { name: "task1", schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", description: "description", attachments: [2], items: [], stories: [], followers_du: [] });
			exp.addObject(2, "Asset", { name: "asset1.png", download_url: "http://example.com/asset1.png" });
			exp.prepareForImport();

			exp.attachmentCursorDataSource()(0, 50).mapPerform("performGets", ["sourceId", "sourceParentId"]).should.deep.equal([
				{ sourceId: 2, sourceParentId: 1 }
			]);
		});
	});
});
