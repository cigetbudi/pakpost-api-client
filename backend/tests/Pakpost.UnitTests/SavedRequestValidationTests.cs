using Pakpost.Application.Internal.Collections.Commands;
using Pakpost.Application.Internal.Collections.Validators;

namespace Pakpost.UnitTests;

public sealed class SavedRequestValidationTests
{
    private readonly SaveRequestValidator _createValidator = new();
    private readonly UpdateSavedRequestValidator _updateValidator = new();

    [Theory]
    [InlineData("GET", true)]
    [InlineData("post", true)]
    [InlineData("PATCH", true)]
    [InlineData("TRACE", false)]
    [InlineData("", false)]
    public void CreateAndUpdateAgreeOnHttpMethod(string method, bool expected)
    {
        var create = MakeRequest() with { Method = method };
        var update = MakeUpdate(create);

        Assert.Equal(expected, _createValidator.Validate(create).IsValid);
        Assert.Equal(expected, _updateValidator.Validate(update).IsValid);
    }

    [Theory]
    [InlineData("{}", "[]", true)]
    [InlineData("[]", "[]", false)]
    [InlineData("{}", "{}", false)]
    [InlineData("invalid", "[]", false)]
    [InlineData("{}", "invalid", false)]
    public void CreateAndUpdateAgreeOnJsonShape(
        string headersJson,
        string formFieldsJson,
        bool expected)
    {
        var create = MakeRequest() with
        {
            HeadersJson = headersJson,
            FormFieldsJson = formFieldsJson
        };

        Assert.Equal(expected, _createValidator.Validate(create).IsValid);
        Assert.Equal(expected, _updateValidator.Validate(MakeUpdate(create)).IsValid);
    }

    [Fact]
    public void AuthorizationSecretsAreRejectedForBothOperations()
    {
        var create = MakeRequest() with
        {
            HeadersJson = """{"Authorization":"Bearer plain-secret"}"""
        };

        Assert.False(_createValidator.Validate(create).IsValid);
        Assert.False(_updateValidator.Validate(MakeUpdate(create)).IsValid);
    }

    [Fact]
    public void AuthorizationPlaceholdersAreAcceptedForBothOperations()
    {
        var create = MakeRequest() with
        {
            HeadersJson = """{"Authorization":"Bearer {{token}}"}"""
        };

        Assert.True(_createValidator.Validate(create).IsValid);
        Assert.True(_updateValidator.Validate(MakeUpdate(create)).IsValid);
    }

    private static SaveRequestCommand MakeRequest()
    {
        return new SaveRequestCommand(
            Guid.NewGuid(),
            Guid.NewGuid(),
            Guid.NewGuid(),
            "Get Account",
            "GET",
            "https://api.example.test/accounts",
            "{}",
            "");
    }

    private static UpdateSavedRequestCommand MakeUpdate(SaveRequestCommand source)
    {
        return new UpdateSavedRequestCommand(
            source.ActorId,
            source.WorkspaceId,
            source.CollectionId,
            Guid.NewGuid(),
            source.Name,
            source.Method,
            source.Url,
            source.HeadersJson,
            source.Body,
            source.BodyMode,
            source.ContentType,
            source.FormFieldsJson,
            source.PreRequestScript,
            source.PostResponseScript,
            ExpectedRevision: 1);
    }
}
