namespace Pakpost.Domain.Entities;
public sealed class RequestEnvironment
{
    private RequestEnvironment() { }
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string Name { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public List<RequestEnvironmentVariable> Variables { get; private set; } = [];
    public RequestEnvironment(Guid workspaceId, string name)
    { Id = Guid.NewGuid(); WorkspaceId = workspaceId; Name = name.Trim(); CreatedAt = DateTimeOffset.UtcNow; }
    public void Update(string name) => Name = name.Trim();
    public void ReplaceVariables(IEnumerable<RequestEnvironmentVariable> variables)
    {
        Variables.Clear(); Variables.AddRange(variables);
    }
}
public sealed class RequestEnvironmentVariable
{
    private RequestEnvironmentVariable() { }
    public Guid Id { get; private set; }
    public Guid EnvironmentId { get; private set; }
    public string Key { get; private set; } = "";
    public string StoredValue { get; private set; } = "";
    public bool IsSecret { get; private set; }
    public RequestEnvironmentVariable(Guid environmentId, string key, string storedValue, bool isSecret)
    { Id=Guid.NewGuid();EnvironmentId=environmentId;Key=key.Trim();StoredValue=storedValue;IsSecret=isSecret; }
}
