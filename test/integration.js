
describe("Importer", function() {
	var app = aei.App.shared();
	var importer, exp, client, orgId, asanaIdCounter;

	function createMock() { return Promise.resolve({ id: asanaIdCounter++ }); }
	function emptyMock() { return Promise.resolve({}); }

	beforeEach(function() {
		sandbox = sinon.sandbox.create();

		lines = [];
		asanaIdCounter = 1;
		orgId = Math.round(Math.random()*1000000);

		app.setSourceToAsanaMap(aei.SourceToAsanaMap.clone());

		importer = aei.Importer.clone();
		importer.setOrganizationId(orgId);
		app.setImporter(importer);

		exp = AsanaExportInMemory.clone();
		importer.setExport(exp);

		client = { workspaces: {}, users: {}, teams: {}, projects: {}, tags: {}, tasks: {}, stories: {} };
		app.setClient(client);
	});
	
	afterEach(function() {
		sandbox.restore();
	});

	describe("#run()", function() {
		it("should run with no data", function() {
			client.workspaces.tags = sinon.stub().returns(Promise.resolve([]));

			importer.run();

			expect(exp.users()).to.deep.equal([]);
			expect(exp.teams()).to.deep.equal([]);
			expect(exp.projects()).to.deep.equal([]);
			expect(exp.taskDataSource()(0,50)).to.deep.equal([]);
			expect(exp.attachmentDataSource()(0,50)).to.deep.equal([]);
		});
	});

	describe("#_importTeams()", function() {
		it("should create some teams", function() {
			client.teams.create = sinon.spy(createMock);

			exp.addObject(100, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(101, "Team", { name: "team2", team_type: "REQUEST_TO_JOIN" });
			exp.addObject(102, "Team", { name: "team3", team_type: "SECRET" });
			exp.prepareForImport();

			expect(exp.teams().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "team1", teamType: "PUBLIC", sourceMemberIds: [] },
				{ sourceId: 101, name: "team2", teamType: "REQUEST_TO_JOIN", sourceMemberIds: [] },
				{ sourceId: 102, name: "team3", teamType: "SECRET", sourceMemberIds: [] },
			]);

			importer._importTeams();

			expect(client.teams.create).to.have.callCount(3);
			expect(client.teams.create).to.have.been.calledWithExactly({ organization: orgId, name: "team1", team_type: "PUBLIC" });
			expect(client.teams.create).to.have.been.calledWithExactly({ organization: orgId, name: "team2", team_type: "REQUEST_TO_JOIN" });
			expect(client.teams.create).to.have.been.calledWithExactly({ organization: orgId, name: "team3", team_type: "SECRET" });
		});
	});

	describe("#_importProjects()", function() {
		beforeEach(function() {
			client.projects.create = sinon.spy(createMock);
			client.teams.create = sinon.spy(createMock);
		});

		it("should not create a project without a team", function() {
			exp.addObject(200, "ItemList", { name: "project1", description: "desc", is_project: true, is_archived: false, team: null, items: [], assignee: null });
			exp.prepareForImport();

			expect(exp.projects().length).to.equal(0);

			importer._importTeams();
			importer._importProjects();

			expect(client.projects.create).to.have.callCount(0);
		});

		it("should create a project with a corresponding team", function() {
			exp.addObject(100, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(200, "ItemList", { name: "project1", description: "desc", is_project: true, is_archived: false, team: 100, items: [], assignee: null });
			exp.prepareForImport();

			expect(exp.projects().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 200, name: "project1", notes: "desc", archived: false, public: false, color: null, sourceTeamId: 100, sourceItemIds: [], sourceMemberIds: [] }
			]);

			importer._importTeams();
			importer._importProjects();

			expect(client.teams.create).to.have.callCount(1);
			expect(client.projects.create).to.have.callCount(1);
			expect(client.projects.create).to.have.been.calledWithExactly({ workspace: orgId, name: "project1", notes: "desc", archived: false, public: false, color: null, team: app.sourceToAsanaMap().at(100) });
		});

		it("should create projects with correct 'public' fields (and defaults to false)", function() {
			exp.addObject(100, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(200, "ItemList", { name: "project1", description: "desc", is_project: true, is_archived: false, team: 100, items: [], is_public_to_workspace: true });
			exp.addObject(201, "ItemList", { name: "project2", description: "desc", is_project: true, is_archived: false, team: 100, items: [], is_public_to_workspace: false });
			exp.addObject(202, "ItemList", { name: "project3", description: "desc", is_project: true, is_archived: false, team: 100, items: [] });
			exp.prepareForImport();

			expect(exp.projects().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 200, name: "project1", notes: "desc", archived: false, public: true, color: null, sourceTeamId: 100, sourceItemIds: [], sourceMemberIds: [] },
				{ sourceId: 201, name: "project2", notes: "desc", archived: false, public: false, color: null, sourceTeamId: 100, sourceItemIds: [], sourceMemberIds: [] },
				{ sourceId: 202, name: "project3", notes: "desc", archived: false, public: false, color: null, sourceTeamId: 100, sourceItemIds: [], sourceMemberIds: [] }
			]);

			importer._importTeams();
			importer._importProjects();

			expect(client.projects.create).to.have.callCount(3);
			expect(client.projects.create).to.have.been.calledWithExactly({ workspace: orgId, name: "project1", notes: "desc", archived: false, public: true, color: null, team: app.sourceToAsanaMap().at(100) });
			expect(client.projects.create).to.have.been.calledWithExactly({ workspace: orgId, name: "project2", notes: "desc", archived: false, public: false, color: null, team: app.sourceToAsanaMap().at(100) });
			expect(client.projects.create).to.have.been.calledWithExactly({ workspace: orgId, name: "project3", notes: "desc", archived: false, public: false, color: null, team: app.sourceToAsanaMap().at(100) });
		});

		it("should not create projects for tags or ATMs", function() {
			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.addObject(400, "ItemList", { name: "tag1",     description: "desc", is_project: false, assignee: null, team: null, is_archived: false, items: [] });
			exp.addObject(401, "ItemList", { name: "My Tasks", description: "desc", is_project: true,  assignee: 200, team: null, is_archived: false, items: [] });
			exp.prepareForImport();

			expect(exp.projects().mapPerform("toJS")).to.deep.equal([]);
			expect(exp.tags().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 400, name: "tag1", sourceItemIds: [], sourceTeamId: null }
			]);

			importer._importProjects();

			expect(client.projects.create).to.have.callCount(0);
		});
	});

	describe("#_importTags()", function() {
		it("should create a tag with and without a team", function() {
			client.teams.create = sinon.spy(createMock);
			client.tags.createInWorkspace = sinon.spy(createMock);
			client.workspaces.tags = sinon.stub().returns(Promise.resolve([]));

			exp.addObject(100, "Team", { name: "team1", is_project: false, assignee: null, team_type: null, items: [] });
			exp.addObject(200, "ItemList", { name: "tag1", is_project: false, assignee: null, team: null, items: [] });
			exp.addObject(201, "ItemList", { name: "tag2", is_project: false, assignee: null, team: 100, items: [] });
			exp.prepareForImport();

			expect(exp.tags().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 200, name: "tag1", sourceTeamId: null, sourceItemIds: [] },
				{ sourceId: 201, name: "tag2", sourceTeamId: 100, sourceItemIds: [] }
			]);

			importer._importTeams();
			importer._importTags();

			expect(client.teams.create).to.have.callCount(1);
			expect(client.tags.createInWorkspace).to.have.callCount(2);
			expect(client.workspaces.tags).to.have.callCount(1);
			expect(client.tags.createInWorkspace).to.have.been.calledWithExactly(orgId, { name: "tag1", team: null });
			expect(client.tags.createInWorkspace).to.have.been.calledWithExactly(orgId, { name: "tag2", team: app.sourceToAsanaMap().at(100) });
		});

		it("should not create duplicate tags", function() {
			client.tags.createInWorkspace = sinon.spy(createMock);
			client.workspaces.tags = sinon.stub().returns(Promise.resolve([
				{ name: "tag1", id: 1 }
			]));

			exp.addObject(100, "ItemList", { name: "tag1", is_project: false, assignee: null, team: null, items: [] });
			exp.prepareForImport();

			expect(exp.tags().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "tag1", sourceTeamId: null, sourceItemIds: [] }
			]);

			importer._importTags();

			expect(client.tags.createInWorkspace).to.have.callCount(0);
			expect(client.workspaces.tags).to.have.callCount(1);
			expect(app.sourceToAsanaMap().at(100)).to.equal(1);
		});
	});

	describe("#_importTasks()", function() {
		beforeEach(function() {
			client.tasks.create = sinon.spy(createMock);
		});

		it("should create a task with and without various properties", function() {
			exp.addObject(100, "Task", { name: "task1", items: [], stories: [], attachments: [], followers_du: [] });
			exp.addObject(101, "Task", { name: "task2", description: "desc", completed: true, schedule_status: "UPCOMING", due_date:"2023-11-30 00:00:00", items: [], stories: [], attachments: [], followers_du: [] });
			exp.prepareForImport();

			expect(exp.taskDataSource()(0,50).mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "task1", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [], stories: [] },
				{ sourceId: 101, name: "task2", notes: "desc", completed: true, dueOn: "2023-11-30 00:00:00", public: false, assigneeStatus: "upcoming", sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [], stories: [] }
			]);

			importer._importTasks();

			expect(client.tasks.create).to.have.callCount(2);
			expect(client.tasks.create).to.have.been.calledWithExactly({ workspace: orgId, name: "task1", notes: "", completed: false, due_on: null, force_public: false, assignee_status: null, hearted: false });
			expect(client.tasks.create).to.have.been.calledWithExactly({ workspace: orgId, name: "task2", notes: "desc", completed: true, due_on: "2023-11-30 00:00:00", force_public: false, assignee_status: "upcoming", hearted: false });
		});

		it("should not create trashed tasks", function() {
			exp.addObject(100, "Task", { name: "task1", __trashed_at: "2023-11-30 00:00:00", items: [], stories: [], attachments: [], followers_du: [] });
			exp.prepareForImport();

			expect(exp.taskDataSource()(0,50).mapPerform("toJS")).to.deep.equal([]);

			importer._importTasks();

			expect(client.tasks.create).to.have.callCount(0);
		});

		it("should create tasks with the correct 'force_public' fields (defaults to false)", function() {
			exp.addObject(100, "Task", { name: "task1", items: [], stories: [], attachments: [], followers_du: [], force_public_to_workspace: true });
			exp.addObject(101, "Task", { name: "task2", items: [], stories: [], attachments: [], followers_du: [], force_public_to_workspace: false });
			exp.addObject(102, "Task", { name: "task3", items: [], stories: [], attachments: [], followers_du: [] });
			exp.prepareForImport();

			expect(exp.taskDataSource()(0,50).mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "task1", notes: "", completed: false, dueOn: null, public: true, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [], stories: [] },
				{ sourceId: 101, name: "task2", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [], stories: [] },
				{ sourceId: 102, name: "task3", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [], stories: [] }
			]);

			importer._importTasks();

			expect(client.tasks.create).to.have.callCount(3);
			expect(client.tasks.create).to.have.been.calledWithExactly({ workspace: orgId, name: "task1", notes: "", completed: false, due_on: null, assignee_status: null, hearted: false, force_public: true });
			expect(client.tasks.create).to.have.been.calledWithExactly({ workspace: orgId, name: "task2", notes: "", completed: false, due_on: null, assignee_status: null, hearted: false, force_public: false });
			expect(client.tasks.create).to.have.been.calledWithExactly({ workspace: orgId, name: "task3", notes: "", completed: false, due_on: null, assignee_status: null, hearted: false, force_public: false });
		});
	});

	describe("#_importStories", function() {
		it("should add stories to the correct task in the correct order, excluding AddAttachmentStory", function() {
			client.workspaces.addUser = sinon.spy(emptyMock);
			client.tasks.create = sinon.spy(createMock);
			client.stories.createOnTask = sinon.spy(createMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.addObject(300, "Task", { name: "task1", items: [], stories: [401, 400, 402], attachments: [], followers_du: [] });
			exp.addObject(400, "Comment", { creator_du: 200, __creation_time: "2014-11-17 22:44:22", text: "comment1" });
			exp.addObject(401, "Comment", { creator_du: 200, __creation_time: "2014-11-17 22:44:22", text: "comment2" });
			exp.addObject(402, "AddAttachmentStory", { creator_du: 200, __creation_time: "2014-11-17 22:44:22", text: "add attachment" });
			exp.prepareForImport();

			expect(exp.taskDataSource()(0,50).mapPerform("toJS")).to.deep.equal([
				{
					sourceId: 300, name: "task1", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [], stories: [
						"user1 commented on Mon Nov 17 2014 22:44:22:\n\ncomment2",
						"user1 commented on Mon Nov 17 2014 22:44:22:\n\ncomment1"
					]
				}
			]);

			importer._importUsers();
			importer._importTasks();
			importer._importStories();

			expect(client.workspaces.addUser).to.have.callCount(1);
			expect(client.tasks.create).to.have.callCount(1);
			expect(client.stories.createOnTask).to.have.callCount(2);
			// reversed to get correct order
			expect(client.stories.createOnTask.getCall(1).args[0]).to.equal(app.sourceToAsanaMap().at(300));
			expect(client.stories.createOnTask.getCall(1).args[1]).to.deep.equal({ text: "user1 commented on Mon Nov 17 2014 22:44:22:\n\ncomment2" });
			expect(client.stories.createOnTask.getCall(0).args[0]).to.equal(app.sourceToAsanaMap().at(300));
			expect(client.stories.createOnTask.getCall(0).args[1]).to.deep.equal({ text: "user1 commented on Mon Nov 17 2014 22:44:22:\n\ncomment1" });
		});
	});

	describe("#_importAttachments", function() {
		var fs = require("fs");

		it("should write the attachment ids to a file", function() {
			client.tasks.create = sinon.spy(createMock);
			sandbox.stub(fs, "appendFile", function (path, text, callback) { callback(null); });

			exp.addObject(100, "Task", { name: "task1", items: [], stories: [], attachments: [200], followers_du: [] });
			exp.addObject(200, "Asset", { name: "asset1.png", download_url: "http://example.com/asset1.png" });
			exp.prepareForImport();

			expect(exp.attachmentDataSource()(0,50).mapPerform("toJS")).to.deep.equal([
				{ sourceId: 200, sourceParentId: 100 }
			]);

			app.setAttachmentsPath("attachments.json");

			importer._importTasks();
			importer._importAttachments();

			expect(client.tasks.create).to.have.callCount(1)
			expect(fs.appendFile).to.have.callCount(1)
			expect(fs.appendFile.getCall(0).args[0]).to.equal("attachments.json");
			expect(fs.appendFile.getCall(0).args[1]).to.match(/^\{[^\n]+\}\n$/);
			expect(JSON.parse(fs.appendFile.getCall(0).args[1])).to.deep.equal({ sourceId: 200, task: app.sourceToAsanaMap().at(100) });
		});
	});

	describe("#_addSubtasksToTasks", function() {
		it("should add subtasks in the correct order", function() {
			client.tasks.create = sinon.spy(createMock);
			client.tasks.setParent = sinon.spy(emptyMock);

			exp.addObject(100, "Task", { name: "task1",    items: [202, 201], attachments: [], followers_du: [], stories: [] });
			exp.addObject(201, "Task", { name: "subtask2", items: [],         attachments: [], followers_du: [], stories: [] });
			exp.addObject(202, "Task", { name: "subtask3", items: [],         attachments: [], followers_du: [], stories: [] });
			exp.prepareForImport();

			expect(exp.taskDataSource()(0,50).mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "task1",    notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [202, 201], sourceFollowerIds: [], stories: [] },
				{ sourceId: 201, name: "subtask2", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [],         sourceFollowerIds: [], stories: [] },
				{ sourceId: 202, name: "subtask3", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [],         sourceFollowerIds: [], stories: [] }
			]);

			importer._importTasks();
			importer._addSubtasksToTasks();

			expect(client.tasks.create).to.have.callCount(3);
			expect(client.tasks.setParent).to.have.callCount(2);
			// reversed to get correct order
			expect(client.tasks.setParent.getCall(1).args).to.deep.equal([app.sourceToAsanaMap().at(202), { parent: app.sourceToAsanaMap().at(100) }])
			expect(client.tasks.setParent.getCall(0).args).to.deep.equal([app.sourceToAsanaMap().at(201), { parent: app.sourceToAsanaMap().at(100) }])
		});
	});

	describe("#_addTasksToProjects", function() {
		it("should add tasks to projects in the correct order", function() {
			client.teams.create = sinon.spy(createMock);
			client.projects.create = sinon.spy(createMock);
			client.tasks.create = sinon.spy(createMock);
			client.tasks.addProject = sinon.spy(emptyMock);

			exp.addObject(100, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(200, "ItemList", { name: "project1", description: "desc", is_project: true, is_archived: false, team: 100, items: [301, 300], assignee: null });
			exp.addObject(300, "Task", { name: "task1", description: null, items: [], attachments: [], followers_du: [], stories: [] });
			exp.addObject(301, "Task", { name: "task2", description: null, items: [], attachments: [], followers_du: [], stories: [] });
			exp.prepareForImport();

			expect(exp.projects().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 200, name: "project1", notes: "desc", sourceTeamId: 100, sourceMemberIds: [], sourceItemIds: [301, 300], archived: false, color: null, public: false }
			]);

			importer._importTeams();
			importer._importProjects();
			importer._importTasks();
			importer._addTasksToProjects();

			expect(client.teams.create).to.have.callCount(1);
			expect(client.projects.create).to.have.callCount(1);
			expect(client.tasks.create).to.have.callCount(2);
			expect(client.tasks.addProject).to.have.callCount(2);
			// reversed to get correct order
			expect(client.tasks.addProject.getCall(1).args).to.deep.equal([app.sourceToAsanaMap().at(301), { project: app.sourceToAsanaMap().at(200) }]);
			expect(client.tasks.addProject.getCall(0).args).to.deep.equal([app.sourceToAsanaMap().at(300), { project: app.sourceToAsanaMap().at(200) }]);
		});
	});

	describe("#_addTasksToTags", function() {
		it("should add tasks to tags in the correct order", function() {
			client.tags.createInWorkspace = sinon.spy(createMock);
			client.workspaces.tags = sinon.stub().returns(Promise.resolve([]));
			client.tasks.create = sinon.spy(createMock);
			client.tasks.addTag = sinon.spy(emptyMock);

			exp.addObject(100, "ItemList", { name: "tag1", is_project: false, assignee: null, team: null, items: [301, 300] });
			exp.addObject(300, "Task", { name: "task1", description: null, items: [], attachments: [], followers_du: [], stories: [] });
			exp.addObject(301, "Task", { name: "task2", description: null, items: [], attachments: [], followers_du: [], stories: [] });
			exp.prepareForImport();

			expect(exp.tags().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "tag1", sourceTeamId: null, sourceItemIds: [301, 300] }
			]);

			importer._importTags();
			importer._importTasks();
			importer._addTasksToTags();

			expect(client.tags.createInWorkspace).to.have.callCount(1);
			expect(client.workspaces.tags).to.have.callCount(1);
			expect(client.tasks.create).to.have.callCount(2);
			expect(client.tasks.addTag).to.have.callCount(2);
			// reversed to get correct order
			expect(client.tasks.addTag.getCall(1).args).to.deep.equal([app.sourceToAsanaMap().at(301), { tag: app.sourceToAsanaMap().at(100) }]);
			expect(client.tasks.addTag.getCall(0).args).to.deep.equal([app.sourceToAsanaMap().at(300), { tag: app.sourceToAsanaMap().at(100) }]);
		});
	});

	describe("#_importUsers", function() {
		it("should add a user to the correct workspace", function() {
			client.workspaces.addUser = sinon.spy(createMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.prepareForImport();

			expect(exp.users().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "user1", email: "user1@example.com", sourceItemIds: [] }
			]);

			importer._importUsers();

			expect(client.workspaces.addUser).to.have.callCount(1);
			expect(client.workspaces.addUser).to.have.been.calledWithExactly(importer.organizationId(), { user: "user1@example.com", opt_silent: true });
		});

		it("should not return deactivated Users", function() {
			client.workspaces.addUser = sinon.spy(createMock);

			exp.addObject(100, "User", { name: "user1", deactivated: true });
			exp.addObject(200, "VerifiedEmail", { ve_user: 100, ve_email: "user1@example.com" });
			exp.addObject(300, "DomainUser", { user: 100, task_list: null });
			exp.prepareForImport();

			expect(exp.users().mapPerform("toJS")).to.deep.equal([]);

			importer._importUsers();

			expect(client.workspaces.addUser).to.have.callCount(0);
		});

		it("should not return active=false DomainUsers", function() {
			client.workspaces.addUser = sinon.spy(createMock);

			exp.addObject(100, "User", { name: "user1", deactivated: false });
			exp.addObject(200, "VerifiedEmail", { ve_user: 100, ve_email: "user1@example.com" });
			exp.addObject(300, "DomainUser", { user: 100, task_list: null, active: false });
			exp.prepareForImport();

			expect(exp.users().mapPerform("toJS")).to.deep.equal([]);

			importer._importUsers();

			expect(client.workspaces.addUser).to.have.callCount(0);
		});
	});

	describe("#_addAssigneesToTasks", function() {
		it("should assign tasks to users in the correct order", function() {
			client.workspaces.addUser = sinon.spy(createMock);
			client.tasks.create = sinon.spy(createMock);
			client.tasks.update = sinon.spy(emptyMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com", 300);
			exp.addObject(300, "ItemList", { name: "My Tasks", description: "", is_project: true, is_archived: false, assignee: 200, items: [401, 400], followers_du: [], is_public_to_workspace: true, is_shared_with_link: false, remind_owner_to_update_status: true });
			exp.addObject(400, "Task", { name: "task1", description: null, items: [], attachments: [], followers_du: [], stories: [] });
			exp.addObject(401, "Task", { name: "task2", description: null, items: [], attachments: [], followers_du: [], stories: [] });
			exp.prepareForImport();

			expect(exp.users().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 100, name: "user1", email: "user1@example.com", sourceItemIds: [401, 400] }
			]);

			importer._importTasks();
			importer._importUsers();
			importer._addAssigneesToTasks();

			expect(client.workspaces.addUser).to.have.callCount(1);
			expect(client.tasks.create).to.have.callCount(2);
			expect(client.tasks.update).to.have.callCount(2);
			// reversed to get correct order
			expect(client.tasks.update.getCall(1).args).to.deep.equal([app.sourceToAsanaMap().at(401), { assignee: app.sourceToAsanaMap().at(100), opt_silent: true }]);
			expect(client.tasks.update.getCall(0).args).to.deep.equal([app.sourceToAsanaMap().at(400), { assignee: app.sourceToAsanaMap().at(100), opt_silent: true }]);
		});
	});

	describe("#_addFollowersToTasks", function() {
		it("should add multiple followers to a task with a single request", function() {
			client.workspaces.addUser = sinon.spy(createMock);
			client.tasks.create = sinon.spy(createMock);
			client.tasks.addFollowers = sinon.spy(emptyMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.addUserAndDomainUser(101, 201, "user2", "user2@example.com");
			exp.addObject(300, "Task", { name: "task1", description: null, items: [], attachments: [], followers_du: [200, 201], stories: [] });
			exp.prepareForImport();

			expect(exp.taskDataSource()(0,50).mapPerform("toJS")).to.deep.equal([
				{ sourceId: 300, name: "task1", notes: "", completed: false, dueOn: null, public: false, assigneeStatus: null, sourceAssigneeId: null, sourceItemIds: [], sourceFollowerIds: [100, 101], stories: [] }
			]);

			importer._importTasks();
			importer._importUsers();
			importer._addFollowersToTasks();

			expect(client.workspaces.addUser).to.have.callCount(2);
			expect(client.tasks.create).to.have.callCount(1);
			expect(client.tasks.addFollowers).to.have.callCount(1);
			expect(client.tasks.addFollowers).to.have.been.calledWithExactly(app.sourceToAsanaMap().at(300), {
				followers: [100, 101].map(function(id) { return app.sourceToAsanaMap().at(id); }),
				opt_silent: true
			});
		});
	});

	describe("#_addMembersToTeams", function() {
		it("should add two members to a team with two API calls", function() {
			client.workspaces.addUser = sinon.spy(createMock);
			client.teams.create = sinon.spy(createMock);
			client.teams.addUser = sinon.spy(emptyMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.addUserAndDomainUser(101, 201, "user2", "user2@example.com");
			exp.addObject(300, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(400, "TeamMembership", { team: 300, member: 200 });
			exp.addObject(401, "TeamMembership", { team: 300, member: 201 });
			exp.prepareForImport();

			expect(exp.teams().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 300, name: "team1", teamType: "PUBLIC", sourceMemberIds: [100, 101] }
			]);

			importer._importTeams();
			importer._importUsers();
			importer._addMembersToTeams();

			expect(client.workspaces.addUser).to.have.callCount(2);
			expect(client.teams.create).to.have.callCount(1);
			expect(client.teams.addUser).to.have.callCount(2);
			expect(client.teams.addUser).to.have.been.calledWithExactly(app.sourceToAsanaMap().at(300), {
				user: app.sourceToAsanaMap().at(100),
				opt_silent: true
			});
			expect(client.teams.addUser).to.have.been.calledWithExactly(app.sourceToAsanaMap().at(300), {
				user: app.sourceToAsanaMap().at(101),
				opt_silent: true
			});
		});

		it("should not include 'limited_access=true' users in a team", function() {
			client.workspaces.addUser = sinon.spy(createMock);
			client.teams.create = sinon.spy(createMock);
			client.teams.addUser = sinon.spy(emptyMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.addObject(300, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(400, "TeamMembership", { team: 300, member: 200, limited_access: true });
			exp.prepareForImport();

			expect(exp.teams().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 300, name: "team1", teamType: "PUBLIC", sourceMemberIds: [] }
			]);

			importer._importTeams();
			importer._importUsers();
			importer._addMembersToTeams();

			expect(client.workspaces.addUser).to.have.callCount(1);
			expect(client.teams.create).to.have.callCount(1);
			expect(client.teams.addUser).to.have.callCount(0);
		});
	});

	describe("#_addMembersToProjects", function() {
		it("should add two members to a project with one API call", function() {
			client.workspaces.addUser = sinon.spy(createMock);
			client.teams.create = sinon.spy(createMock);
			client.projects.create = sinon.spy(createMock);
			client.projects.addMembers = sinon.spy(createMock);

			exp.addUserAndDomainUser(100, 200, "user1", "user1@example.com");
			exp.addUserAndDomainUser(101, 201, "user2", "user2@example.com");
			exp.addObject(300, "Team", { name: "team1", team_type: "PUBLIC" });
			exp.addObject(400, "ItemList", { name: "project1", description: "desc", is_project: true, is_archived: false, team: 300, items: [], assignee: null });
			exp.addObject(500, "ProjectMembership", { project: 400, member: 200 });
			exp.addObject(501, "ProjectMembership", { project: 400, member: 201 });
			exp.prepareForImport();

			expect(exp.projects().mapPerform("toJS")).to.deep.equal([
				{ sourceId: 400, name: "project1", notes: "desc", archived: false, public: false, color: null, sourceTeamId: 300, sourceItemIds: [], sourceMemberIds: [100, 101] }
			]);

			importer._importTeams();
			importer._importProjects();
			importer._importTasks();
			importer._importUsers();
			importer._addMembersToProjects();

			expect(client.workspaces.addUser).to.have.callCount(2);
			expect(client.teams.create).to.have.callCount(1);
			expect(client.projects.create).to.have.callCount(1);
			expect(client.projects.addMembers).to.have.callCount(1);
			expect(client.projects.addMembers).to.have.been.calledWithExactly(app.sourceToAsanaMap().at(400), {
				members: [100, 101].map(function(id) { return app.sourceToAsanaMap().at(id); }),
				opt_silent: true
			});
		});
	});
});