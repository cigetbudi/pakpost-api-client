namespace Pakpost.Domain.Entities;
public sealed class Team
{
    private Team() { }
    public Guid Id { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public Guid CreatedByUserId { get; private set; }
    public string Name { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public Team(Guid workspaceId,Guid creator,string name)
    { Id=Guid.NewGuid();WorkspaceId=workspaceId;CreatedByUserId=creator;Name=name.Trim();CreatedAt=DateTimeOffset.UtcNow; }
}
