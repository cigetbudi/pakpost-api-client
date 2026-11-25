using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Handlers;
using Pakpost.Application.Internal.Collections.Queries;
using Pakpost.Application.Internal.Collections.Validators;
using Pakpost.Application.Internal.Environments.Commands;
using Pakpost.Application.Internal.Environments.DTOs;
using Pakpost.Application.Internal.Environments.Handlers;
using Pakpost.Application.Internal.Environments.Queries;
using Pakpost.Application.Internal.Environments.Services;
using Pakpost.Application.Internal.Workspaces.Services;
using WorkspaceRoleDelegation = Pakpost.Application.Internal.Workspaces.Services.RoleDelegation;
using System.Text.Json;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;
using Pakpost.Domain.Entities;
using Pakpost.Domain.Enums;

var cases=new (string Name,Func<Task> Test)[]
{
    ("Safe Authorization placeholders remain saveable",()=>{
        Assert(SavedHeaderPolicy.ContainsNoLiteralCredentials("""{"Authorization":"Bearer {{token}}","X-API-Key":"{{api_key}}"}"""));
        return Task.CompletedTask;
    }),
    ("Literal Authorization headers cannot be persisted",()=>{
        Assert(!SavedHeaderPolicy.ContainsNoLiteralCredentials("""{"Authorization":"Bearer secret-test-not-a-real-token"}"""));
        return Task.CompletedTask;
    }),
    ("Header whitespace cannot bypass the saved-secret policy",()=>{
        Assert(!SavedHeaderPolicy.ContainsNoLiteralCredentials("""{" Authorization ":"Bearer sample-token"}"""));
        return Task.CompletedTask;
    }),
    ("Disabled metadata header rows cannot persist secrets",()=>{
        Assert(!SavedHeaderPolicy.ContainsNoLiteralCredentials("""{"__pakpost_request_meta_v1__":{"version":1,"headers":[{"key":"X-API-Key","value":"plaintext-secret","enabled":false}]}}"""));
        return Task.CompletedTask;
    }),
    ("Legacy header credentials are cleared in API read DTO",()=>{
        var source="""{"Authorization":"Bearer old-test-value","Accept":"application/json","__pakpost_request_meta_v1__":{"headers":[{"key":"Cookie","value":"session=legacy-value","enabled":true}]}}""";
        var cleaned=SavedHeaderPolicy.RedactLegacyCredentials(source);
        using var parsed=JsonDocument.Parse(cleaned);
        Assert(parsed.RootElement.GetProperty("Authorization").GetString()=="");
        Assert(parsed.RootElement.GetProperty("Accept").GetString()=="application/json");
        Assert(parsed.RootElement.GetProperty("__pakpost_request_meta_v1__").GetProperty("headers")[0].GetProperty("value").GetString()=="");
        Assert(!cleaned.Contains("legacy-value"));
        return Task.CompletedTask;
    }),
    ("Save validator rejects raw credentials but allows placeholders",()=>{
        var validator=new SaveRequestValidator();
        var ws=Guid.NewGuid();var actor=Guid.NewGuid();var col=Guid.NewGuid();
        var unsafeCommand=new SaveRequestCommand(actor,ws,col,"Example","GET","https://example.com","""{"Authorization":"Bearer static-token"}""","");
        var safeCommand=unsafeCommand with {HeadersJson="""{"Authorization":"Bearer {{token}}"}"""};
        Assert(!validator.Validate(unsafeCommand).IsValid);
        Assert(validator.Validate(safeCommand).IsValid);
        return Task.CompletedTask;
    }),
    ("Member sees redacted environment secret with no decryption",()=>{
        var env=new RequestEnvironment(Guid.NewGuid(),"DEV");
        env.ReplaceVariables([new RequestEnvironmentVariable(env.Id,"secret_key","sealed-payload",true),new RequestEnvironmentVariable(env.Id,"baseUrl","https://example.com",false)]);
        var cipher=new FakeCipher();
        var dto=EnvironmentAccess.ToDto(env,cipher,canReadSecrets:false);
        Assert(dto.Variables[0].Value=="" && dto.Variables[0].IsRedacted);
        Assert(dto.Variables[1].Value=="https://example.com");
        Assert(cipher.UnprotectCalls==0);
        Assert(EnvironmentAccess.ToDto(env,cipher,canReadSecrets:true).Variables[0].Value=="test-secret");
        Assert(cipher.UnprotectCalls==1);
        return Task.CompletedTask;
    }),
    ("Environment update preserves tracked variable rows and explicitly inserts/deletes",async()=>{
        var ws=Guid.NewGuid();var owner=Guid.NewGuid();
        var env=new RequestEnvironment(ws,"Old");
        var retained=new RequestEnvironmentVariable(env.Id,"BASE_URL","https://old.test",false);
        var removed=new RequestEnvironmentVariable(env.Id,"OLD_KEY","unused",false);
        env.ReplaceVariables([retained,removed]);
        var repo=new FakeEnvironments(env);
        var handler=new UpdateEnvironmentHandler(new FakeWorkspaces(ws,owner,WorkspaceRole.Owner),repo,new FakeCipher(),new FakeUnitOfWork());
        var updated=await handler.Handle(new UpdateEnvironmentCommand(owner,ws,env.Id,"Dev",[
            new EnvironmentVariableDto("BASE_URL","https://new.test",false),
            new EnvironmentVariableDto("NEW_KEY","value",false)
        ]),CancellationToken.None);
        Assert(env.Name=="Dev"&&updated.Variables.Count==2);
        Assert(env.Variables.Contains(retained)&&retained.StoredValue=="https://new.test");
        Assert(!env.Variables.Contains(removed));
        Assert(repo.AddedVariables.Count==1&&repo.AddedVariables[0].Key=="NEW_KEY");
        Assert(repo.RemovedVariables.Count==1&&ReferenceEquals(repo.RemovedVariables[0],removed));
    }),
    ("Environment create followed by update explicitly tracks first inserted child",async()=>{
        var ws=Guid.NewGuid();var owner=Guid.NewGuid();
        var env=new RequestEnvironment(ws,"Development");var repo=new FakeEnvironments(env);
        var handler=new UpdateEnvironmentHandler(new FakeWorkspaces(ws,owner,WorkspaceRole.Owner),repo,new FakeCipher(),new FakeUnitOfWork());
        await handler.Handle(new UpdateEnvironmentCommand(owner,ws,env.Id,"Development",[
            new EnvironmentVariableDto("TOKEN","top-secret",true)
        ]),CancellationToken.None);
        Assert(repo.AddedVariables.Count==1&&repo.RemovedVariables.Count==0);
        Assert(env.Variables.Count==1&&env.Variables[0].StoredValue=="sealed-payload");
    }),
    ("Cloud collection list returns server-side endpoint count",async()=>{
        var ws=Guid.NewGuid();var owner=Guid.NewGuid();
        var col=new Collection(ws,"API",owner);
        var repo=new FakeCollections();repo.Items.Add(col);repo.RequestCounts[col.Id]=8;
        var handler=new ListCollectionsHandler(repo,new FakeWorkspaces(ws,owner,WorkspaceRole.Owner));
        var listed=await handler.Handle(new ListCollectionsQuery(owner,ws),CancellationToken.None);
        Assert(listed.Count==1&&listed[0].RequestCount==8);
    }),
    ("Member list endpoint does not expose environment secret",async()=>{
        var ws=Guid.NewGuid();var memberId=Guid.NewGuid();var repo=new FakeWorkspaces(ws,memberId,WorkspaceRole.Member);
        var env=new RequestEnvironment(ws,"DEV");
        env.ReplaceVariables([new RequestEnvironmentVariable(env.Id,"apiKey","sealed-payload",true)]);
        var cipher=new FakeCipher();
        var handler=new ListEnvironmentsHandler(repo,new FakeEnvironments(env),cipher);
        var list=await handler.Handle(new ListEnvironmentsQuery(memberId,ws),CancellationToken.None);
        Assert(list.Count==1 && list[0].Variables[0].IsRedacted && list[0].Variables[0].Value=="");
        Assert(cipher.UnprotectCalls==0);
    }),
    ("Member cannot administer workspace resources",async()=>{
        var ws=Guid.NewGuid();var memberId=Guid.NewGuid();var repo=new FakeWorkspaces(ws,memberId,WorkspaceRole.Member);
        await WorkspacePermissions.RequireMemberAsync(repo,ws,memberId,CancellationToken.None);
        await MustBeForbidden(()=>WorkspacePermissions.RequireManagerAsync(repo,ws,memberId,CancellationToken.None));
        await MustBeForbidden(async()=>{await EnvironmentAccess.Verify(repo,ws,memberId,true,CancellationToken.None);});
    }),
    ("Owner/Admin can administer resources and outsiders are forbidden",async()=>{
        var ws=Guid.NewGuid();var id=Guid.NewGuid();
        foreach(var role in new[]{WorkspaceRole.Owner,WorkspaceRole.Admin})
            await WorkspacePermissions.RequireManagerAsync(new FakeWorkspaces(ws,id,role),ws,id,CancellationToken.None);
        await MustBeForbidden(()=>WorkspacePermissions.RequireMemberAsync(new FakeWorkspaces(ws,id,WorkspaceRole.Member),ws,Guid.NewGuid(),CancellationToken.None));
    }),
    ("Developer role can write collections and existing Members migrate to Developer",async()=>{
        var ws=Guid.NewGuid();var id=Guid.NewGuid();var collections=new FakeCollections();
        var collection=new Collection(ws,"Before",id);collections.Items.Add(collection);
        var repo=new FakeWorkspaces(ws,id,WorkspaceRole.Member);var uow=new FakeUnitOfWork();
        await new RenameCollectionHandler(collections,repo,uow)
            .Handle(new RenameCollectionCommand(id,ws,collection.Id,"After"),CancellationToken.None);
        Assert(collection.Name=="After");
        var roles=WorkspacePermissions.RolesOf(new WorkspaceMember(ws,id,WorkspaceRole.Member));
        Assert(roles.SequenceEqual([WorkspaceAccessRole.Developer]));
    }),
    ("QA role cannot create, rename, move or save Cloud requests",async()=>{
        var ws=Guid.NewGuid();var id=Guid.NewGuid();var collections=new FakeCollections();
        var collection=new Collection(ws,"Cloud",id);collections.Items.Add(collection);
        var repo=new FakeWorkspaces(ws,id,WorkspaceRole.Member,[WorkspaceAccessRole.QA]);
        var requests=new FakeSavedRequests();var revisions=new ForbiddenRevisionRepository();
        var cipher=new FakeCipher();var uow=new FakeUnitOfWork();
        await MustBeForbidden(async()=>{await new CreateCollectionHandler(collections,repo,uow)
            .Handle(new CreateCollectionCommand(id,ws,"New"),CancellationToken.None);});
        await MustBeForbidden(async()=>{await new RenameCollectionHandler(collections,repo,uow)
            .Handle(new RenameCollectionCommand(id,ws,collection.Id,"Renamed"),CancellationToken.None);});
        await MustBeForbidden(async()=>{await new SaveRequestHandler(repo,collections,requests,revisions,cipher,uow,new FakeTransactionManager())
            .Handle(new SaveRequestCommand(id,ws,collection.Id,"Testing","GET","https://example.com","{}",""),CancellationToken.None);});
        await MustBeForbidden(async()=>{await new UpdateSavedRequestHandler(repo,collections,requests,revisions,cipher,uow)
            .Handle(new UpdateSavedRequestCommand(id,ws,collection.Id,Guid.NewGuid(),"Testing","GET","https://example.com","{}",""),CancellationToken.None);});
        await MustBeForbidden(async()=>{await new MoveSavedRequestHandler(repo,collections,requests,revisions,cipher,uow,new FakeTransactionManager())
            .Handle(new MoveSavedRequestCommand(id,ws,collection.Id,Guid.NewGuid(),collection.Id),CancellationToken.None);});
        await MustBeForbidden(async()=>{await new DeleteSavedRequestHandler(repo,collections,requests,uow)
            .Handle(new DeleteSavedRequestCommand(id,ws,collection.Id,Guid.NewGuid()),CancellationToken.None);});
        await MustBeForbidden(async()=>{await EnvironmentAccess.Verify(repo,ws,id,true,CancellationToken.None);});
    }),
    ("Multi-role grants union, not role hierarchy or team membership",()=>{
        var admin=WorkspacePermissions.EffectivePermissions([WorkspaceAccessRole.WorkspaceAdmin]);
        Assert(admin.Contains(WorkspacePermissions.MemberManage));
        Assert(!admin.Contains(WorkspacePermissions.CollectionWrite));
        var combined=WorkspacePermissions.EffectivePermissions([WorkspaceAccessRole.WorkspaceAdmin,WorkspaceAccessRole.Developer]);
        Assert(combined.Contains(WorkspacePermissions.CollectionWrite));
        Assert(combined.Contains(WorkspacePermissions.MemberManage));
        foreach(var role in new[]{WorkspaceAccessRole.QA,WorkspaceAccessRole.TechnicalWriter}){
            var rights=WorkspacePermissions.EffectivePermissions([role]);
            Assert(rights.Contains(WorkspacePermissions.RequestExecute));
            Assert(!rights.Contains(WorkspacePermissions.CollectionWrite));
            Assert(!rights.Contains(WorkspacePermissions.EnvironmentSecretRead));
        }
        return Task.CompletedTask;
    }),
    ("Workspace Admin cannot elevate to Team Lead or Workspace Admin",async()=>{
        var ws=Guid.NewGuid();var user=Guid.NewGuid();
        var admin=new WorkspaceMember(ws,user,WorkspaceRole.Admin,[WorkspaceAccessRole.WorkspaceAdmin,WorkspaceAccessRole.Developer]);
        await MustBeForbidden(()=>Task.Run(()=>WorkspaceRoleDelegation.Check(admin,[WorkspaceAccessRole.TeamLead])));
        await MustBeForbidden(()=>Task.Run(()=>WorkspaceRoleDelegation.Check(admin,[WorkspaceAccessRole.WorkspaceAdmin])));
        WorkspaceRoleDelegation.Check(admin,[WorkspaceAccessRole.Developer,WorkspaceAccessRole.QA]);
    }),
    ("Missing role rows do not restore legacy Member write permission",()=>{
        var m=new WorkspaceMember(Guid.NewGuid(),Guid.NewGuid(),WorkspaceRole.Member);
        m.Roles.Clear();
        Assert(WorkspacePermissions.RolesOf(m).Count==0);
        Assert(!WorkspacePermissions.Can(m,WorkspacePermissions.CollectionWrite));
        return Task.CompletedTask;
    }),
    ("Changing roles preserves other assignments and cannot remove the last role",()=>{
        var ws=Guid.NewGuid();var user=Guid.NewGuid();
        var member=new WorkspaceMember(ws,user,WorkspaceRole.Member,[WorkspaceAccessRole.Developer,WorkspaceAccessRole.QA]);
        member.ReplaceRoles([WorkspaceAccessRole.QA,WorkspaceAccessRole.TechnicalWriter]);
        Assert(member.Roles.Count==2 && member.Roles.Any(r=>r.Role==WorkspaceAccessRole.QA) &&
            member.Roles.Any(r=>r.Role==WorkspaceAccessRole.TechnicalWriter));
        var rejected=false;
        try{member.ReplaceRoles([]);}catch(ArgumentException){rejected=true;}
        Assert(rejected);
        return Task.CompletedTask;
    })
};

var failed=0;
foreach(var (name,test) in cases)
{
    try{await test();Console.WriteLine($"PASS {name}");}
    catch(Exception ex){failed++;Console.Error.WriteLine($"FAIL {name}: {ex.Message}");}
}
Console.WriteLine($"Security checks: {cases.Length-failed}/{cases.Length} passed");
if(failed>0)Environment.ExitCode=1;

static void Assert(bool value){if(!value)throw new InvalidOperationException("Assertion failed");}
static async Task MustBeForbidden(Func<Task> run)
{
    try{await run();}catch(AppException ex) when(ex.StatusCode==403){return;}
    throw new InvalidOperationException("Expected HTTP 403");
}
sealed class FakeCipher:IEnvironmentValueCipher
{
    public int UnprotectCalls {get;private set;}
    public string Protect(string clear)=>"sealed-payload";
    public string Unprotect(string encrypted){UnprotectCalls++;return "test-secret";}
}
sealed class FakeEnvironments(RequestEnvironment environment):IRequestEnvironmentRepository
{
    public List<RequestEnvironmentVariable> AddedVariables{get;}=[];
    public List<RequestEnvironmentVariable> RemovedVariables{get;}=[];
    public Task<IReadOnlyList<RequestEnvironment>> ListAsync(Guid workspaceId,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<RequestEnvironment>>([environment]);
    public Task<RequestEnvironment?> FindAsync(Guid id,CancellationToken ct)=>Task.FromResult<RequestEnvironment?>(environment.Id==id?environment:null);
    public void Add(RequestEnvironment value){}
    public void Remove(RequestEnvironment value){}
    public void AddVariable(RequestEnvironmentVariable value)=>AddedVariables.Add(value);
    public void RemoveVariable(RequestEnvironmentVariable value)=>RemovedVariables.Add(value);
}
sealed class FakeWorkspaces(Guid workspaceId,Guid userId,WorkspaceRole role,WorkspaceAccessRole[]? roles=null):IWorkspaceRepository
{
    public Task<WorkspaceMember?> FindMemberAsync(Guid ws,Guid actor,CancellationToken ct)
        =>Task.FromResult<WorkspaceMember?>(ws==workspaceId&&actor==userId?new WorkspaceMember(ws,actor,role,roles):null);
    public Task<WorkspaceMember?> FindMemberForUpdateAsync(Guid ws,Guid actor,CancellationToken ct)
        =>FindMemberAsync(ws,actor,ct);
    public Task<bool> AnyWorkspaceAsync(CancellationToken ct)=>Task.FromResult(true);
    public Task<Workspace?> FindAsync(Guid id,CancellationToken ct)=>Task.FromResult<Workspace?>(null);
    public Task<IReadOnlyList<Workspace>> ListForUserAsync(Guid id,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<Workspace>>([]);
    public Task<IReadOnlyList<WorkspaceMember>> ListMembersAsync(Guid id,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<WorkspaceMember>>([]);
    public Task<int> DeleteOwnedAsync(
        Guid workspaceId,
        Guid founderId,
        CancellationToken ct)
    {
        throw new NotSupportedException("Security test fake does not support workspace deletion.");
    }
    public Task<int> DeleteMemberAsync(Guid workspaceId, Guid userId, CancellationToken ct)
        => throw new NotSupportedException();
    public void Add(Workspace value){}
    public void AddMember(WorkspaceMember value){}
}

sealed class FakeCollections:ICollectionRepository
{
    public List<Collection> Items{get;}=[];
    public Dictionary<Guid,int> RequestCounts{get;}=[];
    public Task<Collection?> FindAsync(Guid id,CancellationToken ct)=>Task.FromResult<Collection?>(Items.FirstOrDefault(x=>x.Id==id));
    public Task<bool> ExistsInWorkspaceAsync(Guid id,Guid ws,CancellationToken ct)
        =>Task.FromResult(Items.Any(x=>x.Id==id&&x.WorkspaceId==ws));
    public Task<IReadOnlyList<CollectionOverview>> ListOverviewAsync(Guid ws,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<CollectionOverview>>(Items.Where(x=>x.WorkspaceId==ws)
            .Select(x=>new CollectionOverview(x.Id,x.WorkspaceId,x.Name,RequestCounts.GetValueOrDefault(x.Id))).ToArray());
    public Task<IReadOnlyList<Collection>> ListForOrganizationAsync(Guid ws,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<Collection>>(Items.Where(x=>x.WorkspaceId==ws).ToArray());
    public Task<bool> HasChildrenAsync(Guid ws,Guid id,CancellationToken ct)
        =>Task.FromResult(Items.Any(x=>x.WorkspaceId==ws&&x.ParentCollectionId==id));
    public Task<IReadOnlyList<Collection>> ListAsync(Guid ws,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<Collection>>(Items.Where(x=>x.WorkspaceId==ws).ToArray());
    public Task<IReadOnlyDictionary<Guid,int>> CountRequestsAsync(Guid ws,CancellationToken ct)
        =>Task.FromResult<IReadOnlyDictionary<Guid,int>>(RequestCounts);
    public void Add(Collection value){}
    public void Remove(Collection value){}
}
sealed class FakeSavedRequests:ISavedRequestRepository
{
    public Task<SavedRequestIndexPage> PageIndexAsync(
        Guid collectionId,
        int size,
        Guid? afterId,
        string? afterName,
        string? search,
        Guid? folderId,
        bool rootOnly,
        bool sortByName,
        CancellationToken ct)
        => Task.FromResult(new SavedRequestIndexPage([], null, false));

    public Task<SavedRequest?> FindAsync(Guid id,CancellationToken ct)=>Task.FromResult<SavedRequest?>(null);
    public Task<SavedRequest?> FindInCollectionAsync(Guid id,Guid collectionId,CancellationToken ct)
        =>Task.FromResult<SavedRequest?>(null);
    public Task<bool> ExistsInCollectionAsync(Guid id,Guid collectionId,CancellationToken ct)
        =>Task.FromResult(false);
    public Task<IReadOnlyList<SavedRequestIndex>> ListIndexAsync(Guid collectionId,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<SavedRequestIndex>>([]);
    public Task<IReadOnlyList<SavedRequest>> ListAsync(Guid id,CancellationToken ct)
        =>Task.FromResult<IReadOnlyList<SavedRequest>>([]);
    public Task<int> CountExistingAsync(Guid col,IReadOnlyCollection<Guid> ids,CancellationToken ct)
        =>Task.FromResult(0);
    public Task<int> DeleteSelectedAsync(Guid col,IReadOnlyCollection<Guid> ids,IReadOnlyCollection<Guid> folders,CancellationToken ct)
        =>Task.FromResult(0);
    // Security checks must not silently perform folder transfer or request reordering.
    // These operations are only allowed after write-permission checks pass.
    public Task<IReadOnlyList<MovedFolderRequestReference>> ListFolderRequestReferencesAsync(
        Guid sourceCollectionId, IReadOnlyCollection<Guid> folderIds, CancellationToken ct)
        =>throw new NotSupportedException("Security test fake does not support folder transfers.");
    public Task<int> MoveFolderRequestsAsync(
        Guid sourceCollectionId, Guid targetCollectionId,
        IReadOnlyCollection<Guid> folderIds, CancellationToken ct)
        =>throw new NotSupportedException("Security test fake does not support folder transfers.");
    public Task<IReadOnlyList<SavedRequest>> ListForReorderAsync(
        Guid collectionId, Guid? folderId, CancellationToken ct)
        =>throw new NotSupportedException("Security test fake does not support request reordering.");
    public void Add(SavedRequest value){}
    public void Remove(SavedRequest value){}
}
// QA mutations must fail permission checks before accessing revision history.
sealed class ForbiddenRevisionRepository:ISavedRequestRevisionRepository
{
    private static InvalidOperationException Unexpected() =>
        new("Forbidden operation accessed request revision history");
    public Task<bool> AnyAsync(Guid requestId,CancellationToken ct) => throw Unexpected();
    public Task<IReadOnlyList<SavedRequestRevision>> ListAsync(Guid requestId,int take,CancellationToken ct) => throw Unexpected();
    public Task<IReadOnlyList<SavedRequestRevisionOverview>> ListOverviewAsync(Guid requestId,int take,CancellationToken ct) => throw Unexpected();
    public Task<SavedRequestRevision?> FindAsync(Guid requestId,int revision,CancellationToken ct) => throw Unexpected();
    public Task TrimAsync(Guid requestId,int keepExisting,CancellationToken ct) => throw Unexpected();
    public void Add(SavedRequestRevision revision) => throw Unexpected();
}
sealed class FakeUnitOfWork:IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken ct)=>Task.FromResult(0);
}

sealed class FakeTransactionManager : ITransactionManager
{
    public Task<ITransactionScope> BeginSerializableAsync(CancellationToken ct) =>
        Task.FromResult<ITransactionScope>(new FakeTransactionScope());
}

sealed class FakeTransactionScope : ITransactionScope
{
    public Task CommitAsync(CancellationToken ct) => Task.CompletedTask;

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
