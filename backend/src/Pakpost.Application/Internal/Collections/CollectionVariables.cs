using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Collections;

public sealed record CollectionVariableDto(string Key, string Value, bool IsSecret=false, bool IsRedacted=false);
public sealed record CollectionVariablesDto(int Version, IReadOnlyList<CollectionVariableDto> Variables);
internal sealed record StoredCollectionVariable(string Key, string StoredValue, bool IsSecret);

public sealed record GetCollectionVariablesQuery(Guid ActorId, Guid WorkspaceId, Guid CollectionId)
    : IRequest<CollectionVariablesDto>;
public sealed record SaveCollectionVariablesCommand(Guid ActorId, Guid WorkspaceId, Guid CollectionId,
    int Version, List<CollectionVariableDto> Variables) : IRequest<CollectionVariablesDto>;

public sealed class SaveCollectionVariablesValidator : AbstractValidator<SaveCollectionVariablesCommand>
{
    public SaveCollectionVariablesValidator()
    {
        RuleFor(x=>x.Version).GreaterThanOrEqualTo(0);
        RuleFor(x=>x.Variables).NotNull().Must(x=>x is not null && x.Count<=100);
        RuleForEach(x=>x.Variables).ChildRules(v=>
        {
            v.RuleFor(x=>x.Key).NotEmpty().MaximumLength(120).Matches("^[A-Za-z_][A-Za-z0-9_]*$");
            v.RuleFor(x=>x.Value).MaximumLength(8192);
        });
        RuleFor(x=>x.Variables).Must(x=>x.Select(y=>y.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count()==x.Count)
            .When(x=>x.Variables is not null).WithMessage("Duplicate variable keys");
    }
}

internal static class CollectionVariableMapper
{
    private static readonly JsonSerializerOptions Options=new() {PropertyNameCaseInsensitive=true};
    public static List<StoredCollectionVariable> Read(string json)
        =>JsonSerializer.Deserialize<List<StoredCollectionVariable>>(json,Options)??[];

    public static CollectionVariablesDto ToDto(int version,List<StoredCollectionVariable> values,
        IEnvironmentValueCipher cipher,bool canReadSecrets)
        =>new(version,values.Select(v=>new CollectionVariableDto(v.Key,
            v.IsSecret?(canReadSecrets?cipher.Unprotect(v.StoredValue):string.Empty):v.StoredValue,
            v.IsSecret,v.IsSecret&&!canReadSecrets)).ToArray());

    private static bool IsSensitiveKey(string key)
    {
        var name=key.ToLowerInvariant();
        return name.Contains("token")||name.Contains("password")||name.Contains("secret")
            ||name.Contains("apikey")||name.Contains("api_key")||name.Contains("authorization");
    }

    public static List<StoredCollectionVariable> ToStored(IReadOnlyList<CollectionVariableDto> incoming,
        List<StoredCollectionVariable> before,IEnvironmentValueCipher cipher)
    {
        var prior=before.ToDictionary(x=>x.Key,StringComparer.OrdinalIgnoreCase);
        return incoming.Select(v=>
        {
            if(v.IsRedacted)
            {
                // An unreadable existing secret must be preserved without disclosing its value.
                if(!prior.TryGetValue(v.Key,out var old)||!old.IsSecret||!v.IsSecret||v.Value.Length>0)
                    throw AppException.BadRequest("Invalid redacted collection variable: "+v.Key);
                return new StoredCollectionVariable(v.Key,old.StoredValue,true);
            }
            bool secret = v.IsSecret || IsSensitiveKey(v.Key);
            return new StoredCollectionVariable(v.Key,secret?cipher.Protect(v.Value):v.Value,secret);
        }).ToList();
    }
}

public sealed class GetCollectionVariablesHandler(ICollectionRepository collections,
    IWorkspaceRepository workspaces,IEnvironmentValueCipher cipher)
    : IRequestHandler<GetCollectionVariablesQuery,CollectionVariablesDto>
{
    public async ValueTask<CollectionVariablesDto> Handle(GetCollectionVariablesQuery query,CancellationToken ct)
    {
        var member=await WorkspacePermissions.RequireAsync(workspaces,query.WorkspaceId,query.ActorId,
            WorkspacePermissions.CollectionRead,ct);
        var item=await collections.FindAsync(query.CollectionId,ct);
        if(item is null||item.WorkspaceId!=query.WorkspaceId)throw AppException.NotFound("Collection not found");
        return CollectionVariableMapper.ToDto(item.VariablesVersion,CollectionVariableMapper.Read(item.VariablesJson),
            cipher,WorkspacePermissions.Can(member,WorkspacePermissions.EnvironmentSecretRead));
    }
}

public sealed class SaveCollectionVariablesHandler(ICollectionRepository collections,
    IWorkspaceRepository workspaces,IEnvironmentValueCipher cipher,IUnitOfWork uow)
    : IRequestHandler<SaveCollectionVariablesCommand,CollectionVariablesDto>
{
    public async ValueTask<CollectionVariablesDto> Handle(SaveCollectionVariablesCommand cmd,CancellationToken ct)
    {
        var member=await WorkspacePermissions.RequireAsync(workspaces,cmd.WorkspaceId,cmd.ActorId,
            WorkspacePermissions.CollectionWrite,ct);
        var item=await collections.FindAsync(cmd.CollectionId,ct);
        if(item is null||item.WorkspaceId!=cmd.WorkspaceId)throw AppException.NotFound("Collection not found");
        if(item.VariablesVersion!=cmd.Version)throw AppException.Conflict("Collection variables changed in another session. Reload before saving.");
        var before=CollectionVariableMapper.Read(item.VariablesJson);
        var after=CollectionVariableMapper.ToStored(cmd.Variables,before,cipher);
        item.SetVariables(JsonSerializer.Serialize(after));
        await uow.SaveChangesAsync(ct);
        return CollectionVariableMapper.ToDto(item.VariablesVersion,after,cipher,
            WorkspacePermissions.Can(member,WorkspacePermissions.EnvironmentSecretRead));
    }
}
